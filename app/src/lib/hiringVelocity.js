// Hiring-velocity signal: a sudden increase in a company's open job-board postings is a
// stronger "they're actively hiring right now" signal than a static headcount/repo count
// (companies post the large majority of new roles within ~30 days of budget approval).
// Built entirely from data this app already fetches — every "Pull all tracked boards" run
// snapshots per-company open-listing counts, and this module diffs snapshots over time.
// No new API calls, no new keys beyond one small localStorage history array.
import { normalizeCompanyName } from './networkGraph.js'
import { lsGet, lsSet } from './scopedStorage.js'

const HISTORY_KEY = 'rec_posting_history'
const MAX_SNAPSHOTS = 60 // daily pulls over ~2 months — comfortably covers any 30d window

// Call after every board pull. One snapshot per calendar day — re-pulling the same day
// overwrites rather than appends, so the history stays a clean daily series regardless of
// how often the user hits refresh.
export function recordPostingSnapshot(jobs) {
  const counts = {}
  for (const j of jobs || []) {
    if (j.status === 'closed') continue
    if (!j.company?.trim()) continue
    const key = normalizeCompanyName(j.company)
    counts[key] = (counts[key] || 0) + 1
  }
  const today = new Date().toISOString().slice(0, 10)
  const history = (lsGet(HISTORY_KEY) || []).filter(s => s.date !== today)
  history.push({ date: today, counts })
  history.sort((a, b) => a.date.localeCompare(b.date))
  lsSet(HISTORY_KEY, history.slice(-MAX_SNAPSHOTS))
}

// Latest snapshot vs. the closest one at least `windowDays` old.
// -> { current, baseline, deltaPct, tier } or null when there's no usable baseline yet
// (first-ever pull, or the company has never shown up in a tracked board) — never guesses
// a trend from a single data point.
export function hiringVelocity(company, windowDays = 14) {
  const history = lsGet(HISTORY_KEY) || []
  if (history.length < 2) return null

  const key = normalizeCompanyName(company)
  const latest = history[history.length - 1]
  const current = latest.counts[key] || 0

  const cutoff = new Date(latest.date).getTime() - windowDays * 86400000
  const older = history.slice(0, -1)
  const baselineSnap = [...older].reverse().find(s => new Date(s.date).getTime() <= cutoff) || older[0]
  if (!baselineSnap) return null
  const baseline = baselineSnap.counts[key] || 0

  if (current === 0 && baseline === 0) return null // nothing to report either way

  const deltaPct = baseline === 0 ? null : Math.round(((current - baseline) / baseline) * 100)
  let tier = 'flat'
  if (baseline === 0 && current > 0) tier = 'new'
  else if (deltaPct !== null && deltaPct >= 50) tier = 'surge'
  else if (deltaPct !== null && deltaPct <= -50) tier = 'cooling'

  return { current, baseline, deltaPct, tier }
}
