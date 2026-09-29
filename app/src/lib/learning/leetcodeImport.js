// LeetCode → Learn tab import. Two public GraphQL reads through the auth-gated `/leetcode`
// proxy (api/gh-api.js → api/_lib/leetcode.js, server-owned queries only):
//   1. profile  — lifetime solved per tag + per difficulty, and the last 20 accepted submissions
//   2. questions — difficulty/tags for recent slugs not already in the curated problem bank
// Recent submissions become dated learning_logs (idempotent on the submission id); the tag
// counts become a `leetcode_snapshot` user setting that mastery.js uses as undated baseline
// evidence (LeetCode only ever exposes the last 20 accepted submissions with dates).
import { authHeader } from '../supabaseClient.js'
import { PROBLEM_BY_SLUG, titleFromSlug } from './problemBank.js'
import { upsertLearningItems, importLearningLogs, setUserSetting } from '../../db.js'

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
  const recent = (d.recentAcSubmissionList || []).map(s => ({
    id: String(s.id), slug: s.titleSlug, title: s.title, timestamp: Number(s.timestamp) * 1000,
  }))
  return { username: d.matchedUser.username, difficulty, tagCounts, recent }
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

// Pure: recent submissions + meta → { items, logs } rows for db.js. Logs reference items by
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
    logs.push({
      _slug: s.slug, trackId, kind: 'problem', source: 'leetcode', externalRef: s.id,
      title: m.title || s.title, difficulty: m.difficulty, outcome: 'solved',
      occurredAt: new Date(s.timestamp).toISOString(),
    })
  }
  return { items: [...items.values()], logs }
}

// Full sync: fetch → resolve → upsert items → import logs (idempotent) → store snapshot.
// Returns { imported, snapshot }.
export async function syncLeetcode({ username, trackId }, call = leetcodeCall) {
  const profile = parseProfile(await call({ op: 'profile', username }))
  const meta = await resolveQuestionMeta(profile.recent.map(r => r.slug), call)
  const { items, logs } = buildImport({ recent: profile.recent, meta, trackId })
  const saved = await upsertLearningItems(items)
  const idBySlug = new Map(saved.map(i => [i.externalRef, i.id]))
  const rows = logs.map(({ _slug, ...l }) => ({ ...l, itemId: idBySlug.get(_slug) || null }))
  const imported = await importLearningLogs(rows)
  const snapshot = { username: profile.username, tagCounts: profile.tagCounts, difficulty: profile.difficulty, syncedAt: new Date().toISOString() }
  await setUserSetting(SNAPSHOT_KEY, snapshot)
  return { imported: imported.length, snapshot }
}
