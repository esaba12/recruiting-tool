// Mastery + gap + goal engine for the Learn tab — pure functions of the user's topics and
// learning_logs (plus the LeetCode tag-count snapshot and Pipeline apps for demand).
// No I/O, no AI: everything here is deterministic and unit-tested (test/learningMastery.test.js).
//
// Shapes (db.js camelCase):
//   topic { id, trackId, name, category, lcTags[], targetLevel, selfRating, weight, hidden }
//   item  { id, tags[], difficulty }
//   log   { id, trackId, topicIds[], itemId, kind, outcome, difficulty, confidence, score, minutes, occurredAt }

const DAY = 86400000
export const HALF_LIFE_DAYS = 30
const OUTCOME_QUALITY = { solved: 1, hinted: 0.55, failed: 0.2 }
const DIFFICULTY_MULT = { Easy: 0.6, Medium: 1, Hard: 1.4 }
// Bulk LeetCode solves from the tag-count snapshot have no dates — count them as old,
// partially-remembered evidence so they seed a level without masking recent failures.
const BASELINE_WEIGHT = 0.3
// How much "solved-equivalent" evidence gets a topic to ~63% of the scale (1 − e⁻¹).
// Problem topics need more reps than concept topics (one good explain-back says a lot).
const SATURATION = { problem: 4, concept: 2 }
// Self-rating acts like this many weighted attempts — it anchors a topic with no evidence
// and fades as real practice accumulates.
const SELF_RATING_WEIGHT = 1.5
export const VERIFIED_MIN_EVIDENCE = 1.5

function ms(d) { return typeof d === 'number' ? d : new Date(d).getTime() }

// Tags a log carries — its item's LeetCode tags (imports / problem logs), if any.
export function logTags(log, itemsById) {
  const item = log.itemId && itemsById ? itemsById.get(log.itemId) : null
  return item?.tags || log.tags || []
}

// A log counts toward a topic when it was explicitly tagged with it, or when one of its
// LeetCode tags is in the topic's lcTags.
export function logMatchesTopic(log, topic, itemsById) {
  if (log.topicIds?.includes(topic.id)) return true
  if (!topic.lcTags?.length) return false
  const tags = logTags(log, itemsById)
  return tags.some(t => topic.lcTags.includes(t))
}

// 0..1 quality of a single log.
export function logQuality(log) {
  if (log.score != null && ['explain_back', 'mock', 'assessment'].includes(log.kind)) {
    return Math.max(0, Math.min(1, log.score / 5))
  }
  if (log.outcome && OUTCOME_QUALITY[log.outcome] != null) return OUTCOME_QUALITY[log.outcome]
  if (log.confidence) return log.confidence / 5
  return 0.5
}

export function decay(occurredAt, now) {
  const ageDays = Math.max(0, (ms(now) - ms(occurredAt)) / DAY)
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS)
}

// Mastery 0..5 for one topic.
//   baselineCount — LeetCode lifetime solves for this topic's tags not already represented by logs.
// Returns { level, evidence (weighted attempts), attempts (raw log count), lastAt, verified }.
export function topicMastery(topic, logs, { now = Date.now(), itemsById, baselineCount = 0 } = {}) {
  let S = 0; let N = 0; let attempts = 0; let lastAt = null
  for (const log of logs) {
    if (!logMatchesTopic(log, topic, itemsById)) continue
    attempts++
    const t = ms(log.occurredAt)
    if (lastAt == null || t > lastAt) lastAt = t
    const mult = DIFFICULTY_MULT[log.difficulty] ?? 1
    // An accepted solve never fades below the undated-baseline weight: a problem solved a
    // year ago (imported from LeetCode history) is still the same old, partly-remembered
    // evidence the tag-count baseline counts it as — the baseline subtracts dated logs, so
    // without this floor importing history would *lower* a topic's level.
    const d = log.kind === 'problem' && log.outcome === 'solved'
      ? Math.max(decay(log.occurredAt, now), BASELINE_WEIGHT)
      : decay(log.occurredAt, now)
    S += d * mult * logQuality(log)
    N += d * mult
  }
  if (baselineCount > 0) { S += baselineCount * BASELINE_WEIGHT; N += baselineCount * BASELINE_WEIGHT }

  const K = topic.lcTags?.length ? SATURATION.problem : SATURATION.concept
  const evidenceLevel = 5 * (1 - Math.exp(-S / K))
  let level
  if (topic.selfRating) {
    level = (topic.selfRating * SELF_RATING_WEIGHT + evidenceLevel * N) / (SELF_RATING_WEIGHT + N)
  } else {
    level = evidenceLevel
  }
  return {
    level: Math.round(level * 10) / 10,
    evidence: Math.round(N * 100) / 100,
    attempts,
    lastAt: lastAt ? new Date(lastAt).toISOString() : null,
    verified: N >= VERIFIED_MIN_EVIDENCE,
  }
}

// LeetCode snapshot { tagSlug: solvedCount } → per-topic baseline. Takes the max over the
// topic's tags (not the sum — one problem is usually tagged array AND hash-table), minus
// the accepted problems already present as dated logs so imports aren't double-counted.
export function baselineForTopic(topic, snapshot, logs, itemsById) {
  if (!snapshot || !topic.lcTags?.length) return 0
  const lifetime = Math.max(0, ...topic.lcTags.map(t => snapshot[t] || 0))
  if (!lifetime) return 0
  // Lifetime counts are distinct problems accepted — so subtract distinct accepted problems,
  // not every log (failed attempts and re-solves aren't in the lifetime number).
  const dated = new Set(logs
    .filter(l => l.source === 'leetcode' && (l.outcome === 'solved' || l.outcome === 'hinted') && logMatchesTopic(l, topic, itemsById))
    .map(l => l.itemId || l.externalRef)).size
  return Math.max(0, lifetime - dated)
}

export function masteryByTopic(topics, logs, { now = Date.now(), itemsById, snapshot } = {}) {
  const out = new Map()
  for (const t of topics) {
    out.set(t.id, topicMastery(t, logs, { now, itemsById, baselineCount: baselineForTopic(t, snapshot, logs, itemsById) }))
  }
  return out
}

// ── Demand: upcoming interviews / OAs in the Pipeline that this track prepares for ──

const TRACK_ROLE_RE = {
  swe: /software|swe|engineer|developer|sde|backend|frontend|full.?stack|data/i,
  pm: /product|\bpm\b|\bapm\b/i,
  ib: /bank|\bib\b|investment|m&a|finance|analyst/i,
  quant: /quant|trad(er|ing)|research/i,
}
const INTERVIEW_STAGES = ['Phone Screen', 'Technical', 'Onsite']
// Categories an online assessment mostly tests — they get the OA boost; interviews boost everything.
const OA_CATEGORIES = new Set(['DSA', 'SQL', 'Coding', 'Math', 'Speed'])

export function appMatchesTrack(app, track) {
  const re = TRACK_ROLE_RE[track?.kind]
  if (!re) return true // custom tracks: any application counts
  return re.test(app.role || '')
}

// { interviews: apps[], oas: apps[] } — live, relevant, soon.
export function trackDemand(track, apps, { now = Date.now(), withinDays = 21 } = {}) {
  const relevant = (apps || []).filter(a => !['Rejected', 'Accepted'].includes(a.stage) && appMatchesTrack(a, track))
  const interviews = relevant.filter(a => INTERVIEW_STAGES.includes(a.stage))
  const oas = relevant.filter(a => {
    if (!a.oaDueDate || a.oaCompleted) return false
    const days = (ms(a.oaDueDate) - ms(now)) / DAY
    return days >= -1 && days <= withinDays
  })
  return { interviews, oas }
}

// How hard a company's asked-problem mix leans on a topic turns into extra demand:
// a topic carrying 40% of a company's frequency mass gets +0.6.
const COMPANY_SHARE_BOOST = 1.5

function demandMultiplier(topic, demand) {
  if (!demand) return 1
  let m = 1
  if (demand.interviews?.length) m += 0.5 * Math.min(2, demand.interviews.length)
  if (demand.oas?.length && OA_CATEGORIES.has(topic.category)) m += 0.75
  const co = demand.companyTopics?.get(topic.id)
  if (co) m += COMPANY_SHARE_BOOST * co.share
  return m
}

// Ranked gaps: topics below target, scored (target − level) × weight × demand.
// Returns [{ topic, mastery, gap, score, reason }] sorted by score desc.
export function rankGaps(topics, mastery, { demand, limit = 8 } = {}) {
  const rows = []
  for (const topic of topics) {
    if (topic.hidden) continue
    const m = mastery.get(topic.id)
    if (!m) continue
    const target = topic.targetLevel ?? 3
    const gap = Math.max(0, target - m.level)
    if (gap < 0.25) continue
    const dm = demandMultiplier(topic, demand)
    rows.push({ topic, mastery: m, gap: Math.round(gap * 10) / 10, score: gap * (topic.weight ?? 1) * dm, reason: gapReason(topic, m, demand, dm) })
  }
  rows.sort((a, b) => b.score - a.score)
  return rows.slice(0, limit)
}

// Deterministic one-liner: why this gap is ranked where it is.
export function gapReason(topic, m, demand, dm = 1) {
  const parts = []
  if (!m.attempts && !topic.selfRating) parts.push('never practiced')
  else if (!m.verified) parts.push('little evidence yet')
  else if (m.lastAt) {
    const days = Math.floor((Date.now() - ms(m.lastAt)) / DAY)
    if (days > 21) parts.push(`last practiced ${days}d ago`)
  }
  if (dm > 1 && demand) {
    const co = demand.companyTopics?.get(topic.id)
    if (co && co.share >= 0.1) parts.push(`${Math.round(co.share * 100)}% of ${co.company}'s asked problems`)
    else if (demand.oas?.length && OA_CATEGORIES.has(topic.category)) parts.push(`OA due for ${demand.oas[0].company}`)
    else if (demand.interviews?.length) parts.push(`interviewing at ${demand.interviews[0].company}`)
  }
  if ((topic.weight ?? 1) >= 1.2) parts.push('high interview frequency')
  return parts.join(' · ') || 'below your target'
}

// ── Goals ──

// Monday 00:00 local of the week containing `now`.
export function startOfWeek(now = Date.now()) {
  const d = new Date(ms(now))
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

function logInScope(log, goal, topicsById, itemsById, scopeTopics) {
  if (!goal.category && !goal.topicId) return true
  if (!scopeTopics.length) return false
  return scopeTopics.some(t => logMatchesTopic(log, t, itemsById))
}

// goal { metric, period: 'week'|'total', target, category?, topicId?, difficulty?, since?, deadline? }
// → { current, target, pct, done, periodLabel, behind }
export function goalProgress(goal, { logs, topics, mastery, itemsById, now = Date.now() }) {
  const topicsById = new Map((topics || []).map(t => [t.id, t]))
  const scopeTopics = goal.topicId
    ? [topicsById.get(goal.topicId)].filter(Boolean)
    : goal.category ? topics.filter(t => t.category === goal.category && !t.hidden) : []
  const from = goal.period === 'week' ? startOfWeek(now) : (goal.since ? ms(goal.since) : 0)
  const inWindow = logs.filter(l => ms(l.occurredAt) >= from && ms(l.occurredAt) <= ms(now) && logInScope(l, goal, topicsById, itemsById, scopeTopics))

  let current = 0
  switch (goal.metric) {
    case 'problems':
      current = inWindow.filter(l => l.kind === 'problem' && l.outcome === 'solved' && (!goal.difficulty || l.difficulty === goal.difficulty)).length
      break
    case 'sessions':
      current = inWindow.filter(l => l.kind !== 'problem').length
      break
    case 'minutes':
      current = inWindow.reduce((s, l) => s + (l.minutes || 0), 0)
      break
    case 'mocks':
      current = inWindow.filter(l => l.kind === 'mock').length
      break
    case 'explain_backs':
      current = inWindow.filter(l => l.kind === 'explain_back').length
      break
    case 'topics_at_target': {
      const pool = scopeTopics.length ? scopeTopics : (topics || []).filter(t => !t.hidden)
      current = pool.filter(t => (mastery?.get(t.id)?.level ?? 0) >= (goal.level ?? t.targetLevel ?? 3)).length
      break
    }
    default:
      current = 0
  }
  const target = Math.max(1, Number(goal.target) || 1)
  const pct = Math.min(1, current / target)

  // Pace: for weekly goals, compare against the fraction of the week elapsed; for deadline
  // goals, against the fraction of time from `since` (or creation) to the deadline.
  let expected = null
  if (goal.period === 'week') expected = (ms(now) - from) / (7 * DAY)
  else if (goal.deadline) {
    const start = goal.since ? ms(goal.since) : ms(now) - 30 * DAY
    const span = ms(goal.deadline) - start
    expected = span > 0 ? (ms(now) - start) / span : 1
  }
  const behind = expected != null && pct + 0.15 < Math.min(1, expected)
  return { current, target, pct, done: current >= target, behind }
}

// ── Activity / streak / difficulty ──

function dayKey(t) {
  const d = new Date(ms(t))
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Consecutive days with ≥1 log, counting back from today (a streak survives until the end
// of today even if nothing is logged yet today).
export function streak(logs, now = Date.now()) {
  const days = new Set(logs.map(l => dayKey(l.occurredAt)))
  let count = 0
  const d = new Date(ms(now)); d.setHours(12, 0, 0, 0)
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d))) { count++; d.setDate(d.getDate() - 1) }
  return count
}

// Last `weeks` Monday-anchored buckets → [{ label, count, minutes }].
export function weeklyActivity(logs, { weeks = 10, now = Date.now() } = {}) {
  const thisWeek = startOfWeek(now)
  const buckets = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = thisWeek - i * 7 * DAY
    const d = new Date(start)
    buckets.push({ start, end: start + 7 * DAY, label: `${d.getMonth() + 1}/${d.getDate()}`, count: 0, minutes: 0 })
  }
  for (const l of logs) {
    const t = ms(l.occurredAt)
    const b = buckets.find(x => t >= x.start && t < x.end)
    if (b) { b.count++; b.minutes += l.minutes || 0 }
  }
  return buckets.map(({ label, count, minutes }) => ({ label, count, minutes }))
}

export function difficultySplit(logs) {
  const out = { Easy: 0, Medium: 0, Hard: 0 }
  for (const l of logs) if (l.kind === 'problem' && l.outcome === 'solved' && out[l.difficulty] != null) out[l.difficulty]++
  return out
}
