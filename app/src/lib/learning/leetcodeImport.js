// LeetCode → Learn tab import. Two public GraphQL reads through the auth-gated `/leetcode`
// proxy (api/gh-api.js → api/_lib/leetcode.js, server-owned queries only):
//   1. profile  — lifetime solved per tag + per difficulty, the last 20 accepted submissions,
//                 and the last 20 submissions of any status (Wrong Answer, TLE, …)
//   2. questions — difficulty/tags for recent slugs not already in the curated problem bank
// Recent submissions become dated learning_logs (idempotent on the submission id); the tag
// counts become a `leetcode_snapshot` user setting that mastery.js uses as undated baseline
// evidence (LeetCode only ever exposes the last 20 accepted submissions with dates).
import { authHeader } from '../supabaseClient.js'
import { PROBLEM_BY_SLUG, titleFromSlug } from './problemBank.js'
import { upsertLearningItems, importLearningLogs, setUserSetting, updateLearningItem } from '../../db.js'
import { scheduleAttempt } from './review.js'

const QUESTIONS_CHUNK = 10
export const SNAPSHOT_KEY = 'leetcode_snapshot'

async function leetcodeCall(payload) {
  const res = await fetch('/leetcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(payload),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `LeetCode request failed (${res.status})`)
  return json
}

// ── Username field ──

// Same rule as api/_lib/leetcode.js's USERNAME_RE (the proxy re-validates).
const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/
const RESERVED_PATHS = new Set(['u', 'problems', 'problemset', 'contest', 'discuss', 'explore', 'study-plan', 'accounts'])

// Field input → username, '' for blank, or null when it isn't one. People paste their
// profile URL (leetcode.com/u/<name>/) as often as the bare name, so accept both.
export function parseLeetcodeUsername(input) {
  let s = String(input ?? '').trim()
  if (!s) return ''
  const url = s.match(/^(?:https?:\/\/)?(?:www\.)?leetcode\.(?:com|cn)\/(.*)$/i)
  if (url) {
    const parts = url[1].split(/[/?#]/).filter(Boolean)
    s = parts[0] === 'u' ? parts[1] || '' : RESERVED_PATHS.has(parts[0]) ? '' : parts[0] || ''
  }
  s = s.replace(/^@/, '')
  return USERNAME_RE.test(s) ? s : null
}

// Field input vs. the saved username → what committing it should do. The panel commits on
// blur, Enter, and when it closes (Escape / ✕ unmount it without a blur), so it must be a
// no-op when nothing changed.
export function planUsernameCommit(input, saved) {
  const u = parseLeetcodeUsername(input)
  if (u === null) return { action: 'invalid' }
  if (u === (saved || '')) return { action: 'none' }
  return { action: 'save', username: u }
}

// Raw GraphQL profile response → normalized shape. Throws on an unknown user.
export function parseProfile(json) {
  const d = json?.data
  if (!d?.matchedUser) {
    const msg = json?.errors?.[0]?.message || 'LeetCode user not found'
    throw new Error(msg)
  }
  const difficulty = {}
  for (const row of d.matchedUser.submitStatsGlobal?.acSubmissionNum || []) difficulty[row.difficulty] = row.count
  const tagCounts = {}
  const groups = d.matchedUser.tagProblemCounts || {}
  for (const level of ['fundamental', 'intermediate', 'advanced']) {
    for (const t of groups[level] || []) tagCounts[t.tagSlug] = t.problemsSolved
  }
  const toSub = s => ({ id: String(s.id), slug: s.titleSlug, title: s.title, timestamp: Number(s.timestamp) * 1000, status: s.statusDisplay || 'Accepted', lang: s.lang || null })
  const recent = (d.recentAcSubmissionList || []).map(toSub)
  const submissions = (d.recentSubmissionList || []).map(toSub)
  const languages = (d.matchedUser.languageProblemCount || [])
    .map(l => ({ name: l.languageName, solved: l.problemsSolved }))
    .sort((a, b) => b.solved - a.solved)
  return { username: d.matchedUser.username, difficulty, tagCounts, recent, submissions, languages }
}

// ── Attempt quality from the any-status submission list ──

const HOUR = 3600000
// Failed submissions within this long before an accept count as that solve's struggle.
export const SESSION_WINDOW_MS = 24 * HOUR
// A failure younger than this may be a solve still in progress — leave it for the next sync.
export const IN_PROGRESS_MS = 30 * 60000
// Compile errors are typos, not misunderstanding — they don't count as wrong attempts.
const isWrong = s => s.status !== 'Accepted' && s.status !== 'Compile Error'

// Pure: accepted list + any-status list → attempts to log.
//   [{ id, slug, title, timestamp, wrong: number|null, statuses: [], failed: bool }]
// `wrong` is null when the accept is older than the any-status window (struggle unknown).
// A run of wrong submissions with no accept within SESSION_WINDOW_MS after it becomes one
// failed attempt, keyed on its last submission id so it's imported once.
export function summarizeAttempts(recent, submissions = [], now = Date.now()) {
  const oldestSeen = submissions.length ? Math.min(...submissions.map(s => s.timestamp)) : Infinity
  const accepts = new Map() // slug → [timestamps] across both lists
  for (const s of [...recent, ...submissions]) {
    if (s.status !== 'Accepted') continue
    if (!accepts.has(s.slug)) accepts.set(s.slug, [])
    accepts.get(s.slug).push(s.timestamp)
  }
  const out = []
  for (const ac of recent) {
    const before = submissions.filter(s => s.slug === ac.slug && isWrong(s) && s.timestamp <= ac.timestamp && ac.timestamp - s.timestamp <= SESSION_WINDOW_MS)
    const known = ac.timestamp >= oldestSeen
    out.push({ ...ac, wrong: known ? before.length : (before.length || null), statuses: [...new Set(before.map(s => s.status))], failed: false })
  }
  // Wrong submissions not followed by an accept on the same problem within the window.
  const orphans = new Map()
  for (const s of submissions) {
    if (!isWrong(s)) continue
    const solved = (accepts.get(s.slug) || []).some(t => t >= s.timestamp && t - s.timestamp <= SESSION_WINDOW_MS)
    if (solved) continue
    if (!orphans.has(s.slug)) orphans.set(s.slug, [])
    orphans.get(s.slug).push(s)
  }
  for (const [slug, subs] of orphans) {
    subs.sort((a, b) => a.timestamp - b.timestamp)
    const last = subs[subs.length - 1]
    if (now - last.timestamp < IN_PROGRESS_MS) continue
    out.push({ id: `fail:${last.id}`, slug, title: last.title, timestamp: last.timestamp, lang: last.lang, wrong: subs.length, statuses: [...new Set(subs.map(s => s.status))], failed: true })
  }
  return out
}

// ── Language proficiency ──

// Submission `lang` codes → the display names LeetCode's languageProblemCount uses.
export const LANG_NAMES = {
  python3: 'Python3', python: 'Python', cpp: 'C++', c: 'C', java: 'Java', javascript: 'JavaScript', typescript: 'TypeScript',
  golang: 'Go', csharp: 'C#', kotlin: 'Kotlin', swift: 'Swift', rust: 'Rust', ruby: 'Ruby', scala: 'Scala', php: 'PHP',
  dart: 'Dart', elixir: 'Elixir', erlang: 'Erlang', racket: 'Racket', mysql: 'MySQL', mssql: 'MS SQL Server',
  oraclesql: 'Oracle', postgresql: 'PostgreSQL', pythondata: 'Pandas', bash: 'Bash',
}
export const langName = code => LANG_NAMES[code] || code
const SEEN_CAP = 400

// Pure: fold newly seen attempts into the running per-language tally kept in the snapshot.
// LeetCode only shows 20 submissions at a time, so this accumulates sync over sync;
// `seen` (capped) stops a re-sync from counting the same attempt twice.
//   prev { byLang: { [name]: { solves, firstTry, struggled, failed, lastAt } }, seen: [ids], since }
export function mergeLanguageStats(prev, attempts, now = Date.now()) {
  const byLang = Object.fromEntries(Object.entries(prev?.byLang || {}).map(([k, v]) => [k, { ...v }]))
  const seen = new Set(prev?.seen || [])
  for (const a of attempts) {
    if (!a.lang || seen.has(a.id)) continue
    seen.add(a.id)
    const name = langName(a.lang)
    const row = byLang[name] || (byLang[name] = { solves: 0, firstTry: 0, struggled: 0, failed: 0, lastAt: null })
    if (a.failed) row.failed++
    else {
      row.solves++
      if (a.wrong === 0) row.firstTry++
      else if (a.wrong > 0) row.struggled++
    }
    if (!row.lastAt || a.timestamp > row.lastAt) row.lastAt = a.timestamp
  }
  return { byLang, seen: [...seen].slice(-SEEN_CAP), since: prev?.since || now }
}

// Attempt → { outcome, confidence, notes }. Confidence drives the re-solve queue
// (review.js): 4 = clean first try (never enqueued, but credits a queued re-solve),
// 3 = one slip (enqueued at a long interval), hinted/failed = enqueued soon.
export function attemptOutcome(a) {
  const tried = a.statuses?.length ? ` (${a.statuses.join(', ')})` : ''
  if (a.failed) return { outcome: 'failed', confidence: null, notes: `Not accepted on LeetCode — ${a.wrong} failed submission${a.wrong === 1 ? '' : 's'}${tried}` }
  if (a.wrong == null) return { outcome: 'solved', confidence: null, notes: null }
  if (a.wrong === 0) return { outcome: 'solved', confidence: 4, notes: 'Accepted first try' }
  if (a.wrong === 1) return { outcome: 'solved', confidence: 3, notes: `Accepted after 1 failed submission${tried}` }
  return { outcome: 'hinted', confidence: null, notes: `Accepted after ${a.wrong} failed submissions${tried}` }
}

// Aliased questions response → Map(slug → { title, difficulty, tags })
export function parseQuestions(json) {
  const out = new Map()
  for (const q of Object.values(json?.data || {})) {
    if (!q?.titleSlug) continue
    out.set(q.titleSlug, { title: q.title, difficulty: q.difficulty, tags: (q.topicTags || []).map(t => t.slug) })
  }
  return out
}

// Bank first (no network), then GraphQL for the rest. Unknown slugs fall back to a
// title-cased slug with no tags rather than failing the import.
export async function resolveQuestionMeta(slugs, call = leetcodeCall) {
  const meta = new Map()
  const missing = []
  for (const slug of new Set(slugs)) {
    const p = PROBLEM_BY_SLUG.get(slug)
    if (p) meta.set(slug, { title: p.title, difficulty: p.difficulty, tags: p.tags })
    else missing.push(slug)
  }
  for (let i = 0; i < missing.length; i += QUESTIONS_CHUNK) {
    const chunk = missing.slice(i, i + QUESTIONS_CHUNK)
    try {
      const found = parseQuestions(await call({ op: 'questions', slugs: chunk }))
      for (const [k, v] of found) meta.set(k, v)
    } catch { /* fail-soft: untagged fallback below */ }
  }
  for (const slug of missing) if (!meta.has(slug)) meta.set(slug, { title: titleFromSlug(slug), difficulty: null, tags: [] })
  return meta
}

// Pure: attempts (summarizeAttempts output, or bare accepted submissions) + meta → { items, logs } rows for db.js. Logs reference items by
// slug (`_slug`) until the caller swaps in real item ids after upserting items.
export function buildImport({ recent, meta, trackId }) {
  const seenSub = new Set()
  const items = new Map()
  const logs = []
  for (const s of recent) {
    if (seenSub.has(s.id)) continue
    seenSub.add(s.id)
    const m = meta.get(s.slug) || { title: s.title, difficulty: null, tags: [] }
    if (!items.has(s.slug)) {
      items.set(s.slug, {
        source: 'leetcode', externalRef: s.slug, title: m.title || s.title,
        url: `https://leetcode.com/problems/${s.slug}/`, difficulty: m.difficulty, tags: m.tags,
      })
    }
    const { outcome, confidence, notes } = attemptOutcome(s)
    logs.push({
      _slug: s.slug, trackId, kind: 'problem', source: 'leetcode', externalRef: s.id,
      title: m.title || s.title, difficulty: m.difficulty, outcome, confidence, notes,
      occurredAt: new Date(s.timestamp).toISOString(),
    })
  }
  return { items: [...items.values()], logs }
}

// Full sync: fetch → resolve → upsert items → import logs (idempotent) → store snapshot.
// `prev` is the stored snapshot; fields that accumulate (language stats, history import
// marker) carry over when it's for the same username. Returns { imported, snapshot }.
//
// Storage model: LeetCode only shows the last 20 submissions, so every attempt is written
// as one learning_logs row the first time a sync sees it (one learning_items row per
// problem) and kept for good. That grows with real practice only — a few KB per hundred
// solves. Syncs are frequent (SYNC_INTERVAL_MS) so the window rarely overflows between
// them, which makes the no-change case the common one: `snapshot.syncedIds` remembers what
// was already stored, and a sync with nothing new does no question lookups and no Supabase
// writes at all (`unchanged: true`).
export const SYNCED_IDS_CAP = 200
const stableJson = v => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x)) // ≫ the 40 ids one profile response can show
export async function syncLeetcode({ username, trackId, prev = null }, call = leetcodeCall) {
  const profile = parseProfile(await call({ op: 'profile', username }))
  const same = prev && prev.username?.toLowerCase() === profile.username.toLowerCase()
  const known = new Set(same ? prev.syncedIds || [] : [])
  const attempts = summarizeAttempts(profile.recent, profile.submissions)
  const fresh = attempts.filter(a => !known.has(a.id))

  let imported = []
  if (fresh.length) {
    const meta = await resolveQuestionMeta(fresh.map(r => r.slug), call)
    const { items, logs } = buildImport({ recent: fresh, meta, trackId })
    const saved = await upsertLearningItems(items)
    const idBySlug = new Map(saved.map(i => [i.externalRef, i.id]))
    const rows = logs.map(({ _slug, ...l }) => ({ ...l, itemId: idBySlug.get(_slug) || null }))
    imported = await importLearningLogs(rows)
    // Only freshly inserted logs touch the re-solve queue, so a re-sync never re-schedules.
    for (const [itemId, srs] of reviewUpdates(imported, saved)) {
      try { await updateLearningItem(itemId, srs) } catch { /* queue catches up next attempt */ }
    }
  }

  const stats = { tagCounts: profile.tagCounts, difficulty: profile.difficulty, languages: profile.languages }
  // Key-order-insensitive: a snapshot read back from jsonb doesn't keep insertion order.
  const statsSame = same && stableJson(stats) === stableJson({ tagCounts: prev.tagCounts, difficulty: prev.difficulty, languages: prev.languages })
  if (!fresh.length && statsSame) {
    return { imported: 0, unchanged: true, snapshot: prev }
  }
  const snapshot = {
    ...(same ? prev : {}),
    username: profile.username, ...stats,
    languageStats: mergeLanguageStats(same ? prev.languageStats : null, attempts),
    syncedIds: [...known, ...fresh.map(a => a.id)].slice(-SYNCED_IDS_CAP),
    syncedAt: new Date().toISOString(),
  }
  await setUserSetting(SNAPSHOT_KEY, snapshot)
  return { imported: imported.length, unchanged: false, snapshot }
}

// How often a browser re-syncs. LeetCode shows only the last 20 submissions, so the gap
// between syncs is what bounds how many solves can scroll away unseen. A no-change sync is
// one GraphQL read and zero DB writes, so this can be short.
export const SYNC_INTERVAL_MS = 3 * 3600000

// lastAt: epoch ms of the last sync on this browser (older builds stored 'YYYY-MM-DD').
export function syncDue(lastAt, now = Date.now()) {
  if (typeof lastAt !== 'number' || !Number.isFinite(lastAt)) return true
  return now - lastAt >= SYNC_INTERVAL_MS
}

// Pure: newly imported logs (any order) + their items → Map(itemId → { srs, dueAt }).
// Replays each item's attempts oldest-first through FSRS, starting from its stored card.
// Attempts with unknown struggle (confidence null on a solve) are skipped.
export function reviewUpdates(importedLogs, items) {
  const byId = new Map(items.map(i => [i.id, { ...i }]))
  const out = new Map()
  const ordered = [...importedLogs].filter(l => l.itemId).sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
  for (const log of ordered) {
    if (log.outcome === 'solved' && log.confidence == null) continue
    const item = byId.get(log.itemId)
    if (!item) continue
    const sched = scheduleAttempt(item, log, new Date(log.occurredAt))
    if (!sched) continue
    Object.assign(item, sched)
    out.set(item.id, sched)
  }
  return out
}

// ── Full-history import (authenticated, one-off) ──
// The public profile only ever shows 20 submissions. userProgressQuestionList — the data
// behind leetcode.com/progress — lists every problem the signed-in user solved or attempted,
// with its last submission time and submission count. It needs the user's LEETCODE_SESSION
// cookie, which the proxy uses for these requests only and never stores.

const MAX_HISTORY_PAGES = 60 // 6,000 problems — more than LeetCode has
const UNKNOWN_DATE_DAYS = 180
const DIFF_NAME = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

function toMs(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v)
    return n < 1e12 ? n * 1000 : n
  }
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

// One page of the GraphQL response → { username, signedIn, total, questions[] }.
export function parseHistoryPage(json) {
  const d = json?.data
  if (!d) throw new Error(json?.errors?.[0]?.message || 'LeetCode history request failed')
  const list = d.userProgressQuestionList
  return {
    username: d.userStatus?.username || '',
    signedIn: !!d.userStatus?.isSignedIn,
    total: list?.totalNum ?? 0,
    questions: (list?.questions || []).map(q => ({
      slug: q.titleSlug,
      title: q.title,
      difficulty: DIFF_NAME[String(q.difficulty || '').toUpperCase()] || null,
      lastAt: toMs(q.lastSubmittedAt),
      submissions: q.numSubmitted ?? null,
      solved: q.questionStatus === 'SOLVED' || q.lastResult === 'AC',
      tags: (q.topicTags || []).map(t => t.slug).filter(Boolean),
    })).filter(q => q.slug),
  }
}

// Pure: history questions → { items, logs }. One log per problem, dated at its last
// submission, keyed `hist:<slug>` so a re-import is a no-op. Problems that already have a
// LeetCode solve logged (`skipSlugs`) are left alone so recent solves aren't double-counted.
// History never enters the re-solve queue: it says *that* you solved something, not how it went.
export function buildHistoryImport({ questions, trackId, skipSlugs = new Set(), now = Date.now() }) {
  const items = []; const logs = []
  for (const q of questions) {
    items.push({ source: 'leetcode', externalRef: q.slug, title: q.title, url: `https://leetcode.com/problems/${q.slug}/`, difficulty: q.difficulty, tags: q.tags })
    if (skipSlugs.has(q.slug)) continue
    const dated = q.lastAt != null
    const subs = q.submissions != null ? `${q.submissions} submission${q.submissions === 1 ? '' : 's'}` : ''
    logs.push({
      _slug: q.slug, trackId, kind: 'problem', source: 'leetcode', externalRef: `hist:${q.slug}`,
      title: q.title, difficulty: q.difficulty, outcome: q.solved ? 'solved' : 'failed', confidence: null,
      notes: ['From LeetCode history', q.solved ? null : 'attempted, never accepted', subs, dated ? null : 'date unknown'].filter(Boolean).join(' · '),
      occurredAt: new Date(dated ? q.lastAt : now - UNKNOWN_DATE_DAYS * 86400000).toISOString(),
    })
  }
  return { items, logs }
}

// Fetch every page → upsert items → import logs in chunks. `expectUsername` (the track's
// configured username) guards against pasting a session for a different account.
// Returns { solved, attempted, imported, skipped, username }.
export async function importLeetcodeHistory({ session, trackId, expectUsername, skipSlugs, onProgress }, call = leetcodeCall) {
  const questions = []
  let username = ''; let total = 0
  for (let page = 0; page < MAX_HISTORY_PAGES; page++) {
    const res = parseHistoryPage(await call({ op: 'history', session, skip: questions.length }))
    if (!res.signedIn) throw new Error('LeetCode didn\'t accept that session — it may have expired. Copy LEETCODE_SESSION again from a logged-in tab.')
    if (expectUsername && res.username.toLowerCase() !== expectUsername.toLowerCase()) {
      throw new Error(`That session is for "${res.username}", but this track syncs "${expectUsername}".`)
    }
    username = res.username; total = res.total
    questions.push(...res.questions)
    onProgress?.({ loaded: questions.length, total })
    if (!res.questions.length || questions.length >= total) break
  }
  const { items, logs } = buildHistoryImport({ questions, trackId, skipSlugs })
  const idBySlug = new Map()
  for (let i = 0; i < items.length; i += 200) {
    for (const it of await upsertLearningItems(items.slice(i, i + 200))) idBySlug.set(it.externalRef, it.id)
  }
  let imported = 0
  const rows = logs.map(({ _slug, ...l }) => ({ ...l, itemId: idBySlug.get(_slug) || null }))
  for (let i = 0; i < rows.length; i += 200) imported += (await importLearningLogs(rows.slice(i, i + 200))).length
  return {
    username,
    solved: questions.filter(q => q.solved).length,
    attempted: questions.filter(q => !q.solved).length,
    imported,
    skipped: questions.length - logs.length,
  }
}
