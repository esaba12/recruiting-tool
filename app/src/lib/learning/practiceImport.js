// Bulk practice import for every Learn track — the non-LeetCode half of "keep all my
// practice". Almost no prep platform has an export or API (Exponent, CaseCoach, WSP/BIWS,
// Zetamac, OpenQuant, CodeSignal…), so this takes what students actually have:
//   • a tracking spreadsheet (CSV, or rows pasted straight from Sheets/Excel)
//   • text — mock feedback emails, notes, a copied results page (AI via lib/ai.js, BYOK)
//   • a screenshot of a score screen (Claude vision — always Claude, like AddToCalendarModal)
// Everything becomes editable drafts in ImportPracticeModal; nothing is written until the
// user commits. Commit goes through db.js's importLearningLogs (idempotent on
// (user_id, source, external_ref)), so re-importing the same sheet or paste is a no-op.
// Parsers and validators are pure and unit-tested (test/practiceImport.test.js).
import { aiJSON, AI_MODELS } from '../ai.js'
import { claudeJSON, CLAUDE_MODELS } from '../claude.js'
import { splitCsvLine } from '../csv.js'
import { hashText } from '../ingest/hashGate.js'
import { todayLocal } from '../dates.js'

export const IMPORT_SOURCE = 'import'
export const IMPORT_KINDS = ['session', 'mock', 'assessment', 'problem']
export const IMPORT_OUTCOMES = ['solved', 'hinted', 'failed']
export const MAX_IMPORT_ROWS = 2000

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v).slice(0, max) : '')
const norm = s => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
const round1 = n => Math.round(n * 10) / 10

// ── Field normalizers ──

// Free text → one of the track's topics, or null. Exact name first, then whole-word
// containment either way (longest topic name wins). Never a fuzzy guess beyond that —
// an unmatched topic is shown to the user, not silently assigned.
export function matchTopic(text, topics) {
  const t = norm(text)
  if (!t) return null
  const byLen = [...topics].sort((a, b) => norm(b.name).length - norm(a.name).length)
  const exact = byLen.find(x => norm(x.name) === t)
  if (exact) return exact
  const padded = ` ${t} `
  const nameInText = byLen.find(x => norm(x.name) && padded.includes(` ${norm(x.name)} `))
  if (nameInText) return nameInText
  if (t.length >= 3) {
    const textInName = byLen.find(x => ` ${norm(x.name)} `.includes(padded))
    if (textInName) return textInName
  }
  // Strong word overlap: ≥2 shared content words covering ≥2/3 of the shorter side
  // ("Why banking story" → "Behavioral / why banking"). One shared word is never enough.
  const words = s => new Set(norm(s).split(' ').filter(w => w.length > 2 && !STOP.has(w)))
  const tw = words(t)
  let best = null; let bestShared = 0
  for (const x of byLen) {
    const xw = words(x.name)
    const shared = [...tw].filter(w => xw.has(w)).length
    if (shared >= 2 && shared / Math.min(tw.size, xw.size) >= 2 / 3 && shared > bestShared) { best = x; bestShared = shared }
  }
  return best
}
const STOP = new Set(['and', 'the', 'for', 'with', 'vs', 'versus', 'practice', 'drill', 'drills', 'session', 'mock', 'story'])

export function normalizeKind(v) {
  const s = norm(v)
  if (IMPORT_KINDS.includes(s)) return s
  if (/\boa\b|assessment|hirevue|codesignal|hackerrank|codility|online test|\btest\b|\bexam\b/.test(s)) return 'assessment'
  if (/mock|interview|\bcase\b|superday|pramp|interviewing io/.test(s)) return 'mock'
  if (/problem|leetcode|question|\bqs?\b/.test(s)) return 'problem'
  return 'session'
}

export function normalizeOutcome(v) {
  const s = norm(v)
  if (!s) return null
  if (IMPORT_OUTCOMES.includes(s)) return s
  if (/fail|couldn ?t|could not|missed|wrong|didn ?t|\bno\b|incomplete/.test(s)) return 'failed'
  if (/hint|partial|struggl|\bok\b|so so|\bmeh\b|almost/.test(s)) return 'hinted'
  if (/pass|solved|\bdone\b|complete|success|got it|\byes\b|accepted|correct/.test(s)) return 'solved'
  return null
}

// Any common score shape → the 0–5 scale mastery.js reads (log.score / 5).
// "82%" → 4.1 · "4/5" → 4 · "7/10" → 3.5 · bare n: ≤5 as is, ≤10 halved, ≤100 a percent.
export function normalizeScore(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (frac) { const d = Number(frac[2]); return d > 0 ? round1(Math.min(5, (Number(frac[1]) / d) * 5)) : null }
  const pct = s.match(/^(\d+(?:\.\d+)?)\s*%$/)
  if (pct) return round1(Math.min(5, Number(pct[1]) / 20))
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (n <= 5) return round1(n)
  if (n <= 10) return round1(n / 2)
  if (n <= 100) return round1(n / 20)
  return null
}

export function parseMinutes(v) {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return null
  const hm = s.match(/^(\d+):(\d{2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?$/)
  if (!m) return null
  const n = Number(m[1])
  const mins = m[2] && m[2].startsWith('h') ? n * 60 : n
  return mins > 0 && mins <= 24 * 60 ? Math.round(mins) : null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = n => String(n).padStart(2, '0')

function ymd(y, m, d) {
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// → 'YYYY-MM-DD' (a local calendar day) or null. Practice already happened, so a date after
// `today` is rejected; a yearless date that would land in the future means last year.
export function parsePracticeDate(v, today = todayLocal()) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const ty = Number(today.slice(0, 4))
  let y = null, m = null, d = null
  let r
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [r[1], r[2], r[3]].map(Number)
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    m = Number(r[1]); d = Number(r[2])
    if (r[3]) y = r[3].length === 2 ? 2000 + Number(r[3]) : Number(r[3])
  } else if ((r = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/))) {
    m = MONTHS.indexOf(r[1].slice(0, 3).toLowerCase()) + 1; d = Number(r[2]); y = r[3] ? Number(r[3]) : null
  } else if ((r = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?$/))) {
    d = Number(r[1]); m = MONTHS.indexOf(r[2].slice(0, 3).toLowerCase()) + 1; y = r[3] ? Number(r[3]) : null
  } else return null
  if (!m || m < 1) return null
  if (y == null) {
    const guess = ymd(ty, m, d)
    if (!guess) return null
    return guess > today ? ymd(ty - 1, m, d) : guess
  }
  const out = ymd(y, m, d)
  return out && out <= today ? out : null
}

// ── Draft shape ──
// { date: 'YYYY-MM-DD', title, kind, topicIds: [], unmatchedTopic: string|null,
//   outcome: 'solved'|'hinted'|'failed'|null, minutes, score (0–5), notes, origin }

function resolveTopics(names, topics) {
  const ids = []; const unmatched = []
  for (const name of names) {
    const t = matchTopic(name, topics)
    if (t) { if (!ids.includes(t.id)) ids.push(t.id) } else if (str(name, 80)) unmatched.push(str(name, 80))
  }
  return { topicIds: ids, unmatchedTopic: unmatched.length ? unmatched.join('; ') : null }
}

// ── CSV ──

const CSV_FIELDS = {
  date: ['date', 'day', 'when', 'date completed', 'completed', 'completed on', 'practiced on'],
  topic: ['topic', 'topics', 'skill', 'subject', 'category', 'area', 'concept'],
  title: ['title', 'name', 'activity', 'what', 'task', 'question', 'problem', 'description', 'exercise'],
  kind: ['type', 'kind', 'format', 'activity type', 'session type'],
  outcome: ['result', 'outcome', 'status', 'solved', 'pass fail'],
  minutes: ['minutes', 'mins', 'duration', 'time', 'time spent', 'length'],
  score: ['score', 'rating', 'grade', 'percent', 'accuracy', 'mark'],
  notes: ['notes', 'note', 'comments', 'feedback', 'reflection', 'takeaways'],
}

function mapPracticeHeaders(headers) {
  const hs = headers.map(norm)
  const idx = {}
  const taken = new Set()
  // Exact header names first, so "Activity Type" isn't claimed by "activity".
  for (const [field, aliases] of Object.entries(CSV_FIELDS)) {
    const i = hs.findIndex((h, j) => !taken.has(j) && aliases.includes(h))
    if (i >= 0) { idx[field] = i; taken.add(i) }
  }
  for (const [field, aliases] of Object.entries(CSV_FIELDS)) {
    if (idx[field] != null) continue
    const i = hs.findIndex((h, j) => !taken.has(j) && aliases.some(a => ` ${h} `.includes(` ${a} `)))
    if (i >= 0) { idx[field] = i; taken.add(i) }
  }
  return idx
}

// CSV text (or tab-separated rows pasted from a spreadsheet) → { drafts, skipped, mapping, error? }.
// A row needs a date and a title or topic; anything else is skipped and counted, never guessed.
export function parsePracticeCsv(text, { topics = [], today = todayLocal() } = {}) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { drafts: [], skipped: 0, mapping: {} }
  // Rows pasted from Sheets/Excel are tab-separated and their cells often contain commas;
  // splitCsvLine treats both as delimiters, so a tab header means split on tabs only.
  const split = lines[0].includes('\t')
    ? line => line.split('\t').map(c => c.trim().replace(/^"(.*)"$/s, '$1').replace(/""/g, '"'))
    : splitCsvLine
  const idx = mapPracticeHeaders(split(lines[0]))
  if (idx.date == null) return { drafts: [], skipped: lines.length - 1, mapping: idx, error: 'Need a date column (Date, Day, Completed…)' }
  if (idx.topic == null && idx.title == null) return { drafts: [], skipped: lines.length - 1, mapping: idx, error: 'Need a topic or a title column' }
  const cell = (cells, f) => (idx[f] != null ? cells[idx[f]] ?? '' : '')
  const drafts = []
  let skipped = 0
  for (const line of lines.slice(1, MAX_IMPORT_ROWS + 1)) {
    const cells = split(line)
    const date = parsePracticeDate(cell(cells, 'date'), today)
    const topicText = cell(cells, 'topic')
    const titleText = cell(cells, 'title')
    if (!date || (!topicText && !titleText)) { skipped++; continue }
    const kindText = cell(cells, 'kind')
    const { topicIds, unmatchedTopic } = resolveTopics(topicText ? topicText.split(/[;|]/) : [titleText], topics)
    drafts.push({
      date,
      title: str(titleText || topicText, 120),
      kind: normalizeKind(kindText || titleText),
      topicIds,
      // A title column that didn't name a topic isn't "unmatched" — only an explicit topic is.
      unmatchedTopic: topicText ? unmatchedTopic : null,
      outcome: normalizeOutcome(cell(cells, 'outcome')),
      minutes: parseMinutes(cell(cells, 'minutes')),
      score: normalizeScore(cell(cells, 'score')),
      notes: str(cell(cells, 'notes'), 500),
      origin: 'csv',
    })
  }
  skipped += Math.max(0, lines.length - 1 - MAX_IMPORT_ROWS)
  return { drafts, skipped, mapping: idx }
}

const csvCell = v => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v))

// A ready-to-fill CSV for a track: the header the parser reads plus one example row per
// category, using the track's real topic names so matching is exact.
export function practiceCsvTemplate(topics, today = todayLocal()) {
  const header = 'Date,Topic,Type,Result,Minutes,Score,Notes'
  const seen = new Set()
  const rows = []
  for (const t of topics) {
    if (seen.has(t.category)) continue
    seen.add(t.category)
    rows.push([today, t.name, rows.length % 2 ? 'Study' : 'Mock interview', '', rows.length % 2 ? '30' : '45', rows.length % 2 ? '' : '4/5', ''].map(csvCell).join(','))
  }
  return `${header}\n${rows.join('\n')}\n`
}

// ── AI (paste + screenshot) ──

export function practicePrompt({ trackName, topics, today, fromImage = false }) {
  const list = topics.map(t => `- ${t.name} (${t.category})`).join('\n')
  return `A student preparing for ${trackName} interviews is logging practice they already did, from ${fromImage ? 'a screenshot (a score screen, feedback page or tracker)' : 'pasted text (feedback emails, notes, a copied results page or tracker)'}. Today is ${today}.

Their tracked topics — use these exact names, and only these:
${list || '- (none)'}

Return one item per distinct practice activity:
- "date": "YYYY-MM-DD" when it happened. Use the date stated in the source. If the source gives no date for an activity, use null. Never invent a date. If a year is missing, assume the most recent past occurrence.
- "title": a short label (e.g. "DCF mock with Jane", "Zetamac 120s")
- "kind": one of "mock" (a mock or practice interview / case), "assessment" (an OA, HireVue, timed test), "problem" (one coding/technical question), "session" (study, drills, reading)
- "topics": names from the list above that this activity practiced. If it clearly practiced something not on the list, include that name as written; never stretch a topic to fit.
- "outcome": "solved" | "hinted" | "failed" or null (only for a single question or OA with a clear result)
- "score": the score as written (e.g. "4/5", "82%", "62") or null
- "minutes": number or null
- "notes": one sentence of the feedback or takeaway as stated in the source, or ""
Do not grade or comment on the work yourself.

Return ONLY JSON: {"items":[...]}`
}

// Model output → drafts. Kinds/outcomes are forced onto the allowed sets, topic names are
// mapped onto real topic ids (unknown ones surface as unmatchedTopic), and anything
// without a real past date is dropped.
export function validatePracticeItems(parsed, { topics = [], today = todayLocal(), source = 'paste' } = {}) {
  const items = Array.isArray(parsed?.items) ? parsed.items : []
  const out = []
  for (const it of items.slice(0, 100)) {
    if (!it || typeof it !== 'object') continue
    const date = typeof it.date === 'string' ? parsePracticeDate(it.date, today) : null
    if (!date) continue
    const names = Array.isArray(it.topics) ? it.topics.filter(n => typeof n === 'string') : []
    const { topicIds, unmatchedTopic } = resolveTopics(names, topics)
    const title = str(it.title, 120) || names[0] || 'Practice'
    const minutes = it.minutes == null ? null : parseMinutes(String(it.minutes))
    out.push({
      date, title,
      kind: normalizeKind(str(it.kind, 40)),
      topicIds, unmatchedTopic,
      outcome: typeof it.outcome === 'string' ? normalizeOutcome(it.outcome) : null,
      minutes,
      score: it.score == null ? null : normalizeScore(String(it.score)),
      notes: str(it.notes, 500),
      origin: source,
    })
  }
  return out
}

export async function extractPracticeFromText(text, { trackName, topics, today = todayLocal() }) {
  const content = `${practicePrompt({ trackName, topics, today })}\n\nSource:\n"""\n${String(text).slice(0, 20000)}\n"""`
  const parsed = await aiJSON({ model: AI_MODELS.STANDARD, content, maxTokens: 3000 })
  return validatePracticeItems(parsed, { topics, today, source: 'paste' })
}

// Vision always goes to Claude directly (same rule as AddToCalendarModal): the two
// providers' image formats differ and only this path is verified.
export async function extractPracticeFromImage({ imageBase64, text = '' }, { trackName, topics, today = todayLocal() }) {
  const content = [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
    { type: 'text', text: `${practicePrompt({ trackName, topics, today, fromImage: true })}${text.trim() ? `\n\nExtra context from the student:\n"""\n${text.slice(0, 4000)}\n"""` : ''}` },
  ]
  const parsed = await claudeJSON({ model: CLAUDE_MODELS.SONNET, content, maxTokens: 2000 })
  return validatePracticeItems(parsed, { topics, today, source: 'screenshot' })
}

// ── Commit ──

// Drafts → learning_logs rows. The fingerprint is date + kind + title + topics (not notes,
// score or minutes, so fixing a typo or a score in the sheet and re-importing doesn't
// double the row). Identical activities on the same day get an occurrence index so two
// real sessions stay two rows, and the same sheet imported again maps to the same refs.
export function draftsToLogs(drafts, trackId) {
  const seen = new Map()
  return drafts.map(d => {
    const base = hashText([d.date, d.kind, norm(d.title), [...(d.topicIds || [])].sort().join(',')].join('|'))
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    const [y, m, day] = d.date.split('-').map(Number)
    return {
      trackId, kind: d.kind, source: IMPORT_SOURCE, externalRef: `imp:${base}${n > 1 ? `:${n}` : ''}`,
      title: d.title || null, topicIds: d.topicIds || [], outcome: d.outcome || null,
      minutes: d.minutes ?? null, score: d.score ?? null, confidence: null,
      notes: d.notes || null,
      occurredAt: new Date(y, m - 1, day, 12).toISOString(),
    }
  })
}
