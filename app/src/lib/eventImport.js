// Paste / CSV / ICS → staged EventDrafts for the import modal. Extraction runs
// client-side (paste goes through lib/ai.js with the user's key; CSV/ICS are
// parsed locally); nothing here writes — api/events-contribute.js does, after
// the user reviews the drafts.
import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'
import { localToIso, parseCompactLocal, isValidTimeZone } from './ingest/tz.js'
import { dedupKey } from './ingest/dedup.js'
import { classifyKind, extractEmployer } from './ingest/adapters/localist.js'
import { REQUIREMENT_KINDS } from './eventRequirements.js'

// ── ICS ─────────────────────────────────────────────────────────────────────
function unfold(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function icsProp(line) {
  const i = line.indexOf(':')
  if (i < 0) return null
  const [name, ...params] = line.slice(0, i).split(';')
  const p = {}
  for (const kv of params) { const [k, v] = kv.split('='); if (k) p[k.toUpperCase()] = v }
  return { name: name.toUpperCase(), params: p, value: line.slice(i + 1) }
}

function icsUnescape(s) { return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\') }

function icsDate(value, params, defaultTz) {
  if (!value) return null
  if (/^\d{8}$/.test(value)) return { allDay: true, iso: localToIso(parseCompactLocal(value), params.TZID && isValidTimeZone(params.TZID) ? params.TZID : defaultTz) }
  if (/Z$/.test(value)) return { allDay: false, iso: new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15) || '00'}Z`).toISOString() }
  const parts = parseCompactLocal(value)
  if (!parts) return null
  const tz = params.TZID && isValidTimeZone(params.TZID) ? params.TZID : defaultTz
  return { allDay: false, iso: localToIso(parts, tz) }
}

export function parseIcs(text, { timezone = 'UTC' } = {}) {
  const lines = unfold(text).split('\n')
  const drafts = []
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur?.SUMMARY && cur.DTSTART) {
        const start = icsDate(cur.DTSTART.value, cur.DTSTART.params, timezone)
        const end = cur.DTEND ? icsDate(cur.DTEND.value, cur.DTEND.params, timezone) : null
        const title = icsUnescape(cur.SUMMARY.value)
        const kind = classifyKind(title)
        const employerName = extractEmployer(title, kind)
        drafts.push({
          title, kind, description: icsUnescape(cur.DESCRIPTION?.value || ''), location: icsUnescape(cur.LOCATION?.value || ''),
          isVirtual: /virtual|zoom|online/i.test(cur.LOCATION?.value || ''),
          startsAt: start?.iso || null, endsAt: end?.iso || null, allDay: !!start?.allDay, timezone,
          url: cur.URL?.value || null, registrationUrl: null, employerName,
          sourceKind: 'ics', sourceRef: cur.UID?.value || null, confidence: 0.95,
          dedupKey: dedupKey({ title, employerName, startsAt: start?.iso }),
          requirements: [],
        })
      }
      cur = null; continue
    }
    if (!cur) continue
    const p = icsProp(line)
    if (p) cur[p.name] = p
  }
  return drafts.filter(d => d.startsAt)
}

// ── CSV ─────────────────────────────────────────────────────────────────────
function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',' || c === '\t') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

const HEADER_ALIASES = {
  title: ['title', 'name', 'event', 'event name', 'summary', 'subject'],
  start: ['start', 'start time', 'starts', 'date', 'datetime', 'start date', 'when', 'begins'],
  end: ['end', 'end time', 'ends', 'end date'],
  location: ['location', 'where', 'venue', 'room', 'place'],
  url: ['url', 'link', 'website', 'more info'],
  registrationUrl: ['registration', 'register', 'rsvp', 'signup', 'sign up', 'registration url', 'registration link'],
  employer: ['employer', 'company', 'host', 'organization', 'org'],
  description: ['description', 'details', 'notes', 'about'],
  kind: ['kind', 'type', 'category', 'event type'],
}

function mapHeaders(headers) {
  const idx = {}
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim()
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) if (aliases.includes(key) && idx[field] == null) idx[field] = i
  })
  return idx
}

function parseLooseDate(s, timezone) {
  if (!s) return null
  const compact = parseCompactLocal(s.replace(' ', 'T'))
  if (compact && /^\d{4}-?\d{2}-?\d{2}/.test(s)) return localToIso(compact, timezone)
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

export function parseCsv(text, { timezone = 'UTC' } = {}) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim())
  if (lines.length < 2) return { drafts: [], mapping: {}, skipped: 0 }
  const headers = splitCsvLine(lines[0])
  const idx = mapHeaders(headers)
  if (idx.title == null || idx.start == null) return { drafts: [], mapping: idx, skipped: lines.length - 1, error: 'Need at least a title column and a start/date column' }
  const drafts = []
  let skipped = 0
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const title = cells[idx.title]
    const startsAt = parseLooseDate(cells[idx.start], timezone)
    if (!title || !startsAt) { skipped++; continue }
    const endsAt = idx.end != null ? parseLooseDate(cells[idx.end], timezone) : null
    const kindCell = idx.kind != null ? cells[idx.kind] : ''
    const kind = classifyKind(`${title} ${kindCell}`)
    const employerName = (idx.employer != null && cells[idx.employer]) || extractEmployer(title, kind) || null
    drafts.push({
      title, kind, description: idx.description != null ? cells[idx.description] : '', location: idx.location != null ? cells[idx.location] : '',
      isVirtual: /virtual|zoom|online/i.test(idx.location != null ? cells[idx.location] : ''),
      startsAt, endsAt, allDay: !/T\d{2}/.test(startsAt) && !/\d{1,2}:\d{2}/.test(cells[idx.start] || ''), timezone,
      url: idx.url != null ? cells[idx.url] || null : null, registrationUrl: idx.registrationUrl != null ? cells[idx.registrationUrl] || null : null,
      employerName, sourceKind: 'csv', sourceRef: null, confidence: 0.9,
      dedupKey: dedupKey({ title, employerName, startsAt }), requirements: [],
    })
  }
  return { drafts, mapping: idx, skipped }
}

// ── Paste (AI) ──────────────────────────────────────────────────────────────
export const PASTE_PROMPT_HEADER = (timezone, today) => `You are extracting campus recruiting events from text a student pasted (a Handshake or Career Fair Plus listing, an email, a copied table, a flyer). Today is ${today}; the campus time zone is ${timezone}. Return every distinct event you can find with:
- "title", "kind" (one of career_fair | info_session | coffee_chat | workshop | networking | other), "employer" (single hosting company or null)
- "start" and "end" as "YYYY-MM-DDTHH:MM" in the campus zone (end null if not stated; if only a date is given use T00:00 and set "all_day": true)
- "location", "virtual" (true/false), "url", "registration_url", "description" (1–2 sentences, from the text)
- "requirements": signup steps the text states, in order, each {"kind": one of ${JSON.stringify(REQUIREMENT_KINDS)}, "label", "url" or null, "due": "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" or null, "required": true|false}
- "confidence": 0–1, how sure you are the event, its date and time are stated (not guessed). Never invent a date; if the year is missing assume the next occurrence after today.
Return ONLY valid JSON, no markdown: {"items":[...]}

Text:
`

export async function extractFromPaste(text, { timezone = 'UTC' } = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const parsed = await aiJSON({ model: AI_MODELS.STANDARD, content: PASTE_PROMPT_HEADER(timezone, today) + text.slice(0, 12000), maxTokens: 3000 })
  const drafts = []
  for (const it of parsed.items || []) {
    const sp = parseCompactLocal(it.start || '')
    if (!it.title || !sp) continue
    const startsAt = localToIso(sp, timezone)
    const ep = it.end ? parseCompactLocal(it.end) : null
    const kind = EVENT_KIND_SET.has(it.kind) ? it.kind : classifyKind(it.title)
    const employerName = it.employer || extractEmployer(it.title, kind) || null
    drafts.push({
      title: it.title, kind, description: it.description || '', location: it.location || '', isVirtual: !!it.virtual,
      startsAt, endsAt: ep ? localToIso(ep, timezone) : null, allDay: !!it.all_day, timezone,
      url: it.url || null, registrationUrl: it.registration_url || null, employerName,
      sourceKind: 'paste', sourceRef: null,
      confidence: Math.max(0, Math.min(1, Number(it.confidence ?? 0.6) || 0)),
      dedupKey: dedupKey({ title: it.title, employerName, startsAt }),
      requirements: Array.isArray(it.requirements) ? it.requirements : [],
    })
  }
  return drafts
}
const EVENT_KIND_SET = new Set(['career_fair', 'info_session', 'coffee_chat', 'workshop', 'networking', 'other'])

// Manual entry → draft (confidence 1: the user typed it).
export function manualDraft({ title, kind = 'other', start, end, allDay = false, location = '', isVirtual = false, url = null, registrationUrl = null, employerName = null, description = '', timezone = 'UTC' }) {
  const sp = parseCompactLocal(start || '')
  if (!title || !sp) return null
  const startsAt = localToIso(sp, timezone)
  const ep = end ? parseCompactLocal(end) : null
  return {
    title, kind, description, location, isVirtual, startsAt, endsAt: ep ? localToIso(ep, timezone) : null, allDay, timezone,
    url, registrationUrl, employerName, sourceKind: 'manual', sourceRef: null, confidence: 1,
    dedupKey: dedupKey({ title, employerName, startsAt }), requirements: [],
  }
}

// ── commit ──────────────────────────────────────────────────────────────────

async function post(body) {
  const res = await fetch('/api/events-contribute', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Import failed (${res.status})`)
  return data
}

export function contributeDrafts(drafts, { share = true } = {}) { return post({ items: drafts, share }) }
export function promoteEvent(eventId) { return post({ promote: eventId }) }
export function removeOwnEvent(eventId) { return post({ remove: eventId }) }
