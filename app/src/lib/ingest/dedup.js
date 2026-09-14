// Event identity for the shared pool — used by feed ingestion, paste-import
// (contributed events) and the DB's hard backstop index alike.
//
//   dedupKey          — deterministic semantic key: normalized title | employer |
//                       start bucketed to the hour (UTC). Stored on events.dedup_key
//                       and unique per school among shared, non-archived rows.
//   findNearDuplicate — the softer ±window match ingestion runs BEFORE insert, so a
//                       contributed "Anthropic Info Session 6:05pm" collides with the
//                       ingested "Anthropic Info Session 6:00pm" instead of landing twice.

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'for', 'at', 'in', 'on', 'with', 'to', 'by', '&'])

export function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w))
    .join(' ')
    .trim()
}

export function normalizeEmployer(name) {
  return (name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function hourBucketUtc(iso) {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return 'nodate'
  return String(Math.floor(ms / 3600000))
}

export function dedupKey({ title, employerName, startsAt }) {
  return `${normalizeTitle(title)}|${normalizeEmployer(employerName)}|${hourBucketUtc(startsAt)}`
}

// Title similarity — token Jaccard, tolerant of "hosted by SWE/TBP" style suffixes.
export function titleSimilarity(a, b) {
  const ta = new Set(normalizeTitle(a).split(' ').filter(Boolean))
  const tb = new Set(normalizeTitle(b).split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const w of ta) if (tb.has(w)) inter++
  return inter / (ta.size + tb.size - inter)
}

// draft/existing: { title, employerName?, startsAt } · returns the best existing
// match within `windowMin` of the start whose title is near-identical, or null.
export function findNearDuplicate(draft, existing, { windowMin = 60, minSimilarity = 0.8 } = {}) {
  const start = new Date(draft.startsAt).getTime()
  if (Number.isNaN(start)) return null
  const draftEmp = normalizeEmployer(draft.employerName)
  let best = null
  for (const e of existing) {
    const t = new Date(e.startsAt).getTime()
    if (Number.isNaN(t) || Math.abs(t - start) > windowMin * 60000) continue
    const eEmp = normalizeEmployer(e.employerName)
    if (draftEmp && eEmp && draftEmp !== eEmp) continue      // both known and different → distinct events
    const sim = titleSimilarity(draft.title, e.title)
    if (sim >= minSimilarity && (!best || sim > best.sim)) best = { event: e, sim }
  }
  return best?.event || null
}

// Collapse duplicates WITHIN one batch (a feed listing the same occurrence twice,
// or a paste that repeats a row). Keeps the first occurrence.
export function dedupWithin(drafts, opts) {
  const kept = []
  for (const d of drafts) {
    if (kept.some(k => k.dedupKey === d.dedupKey) || findNearDuplicate(d, kept, opts)) continue
    kept.push(d)
  }
  return kept
}
