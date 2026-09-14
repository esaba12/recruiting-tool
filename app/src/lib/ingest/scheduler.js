// Polling scheduler shared by Discover's per-company refresh and Recruiting
// Events' per-source refresh — lifted from lib/discoveryScheduler.js.
//
//   pickDue  — cooldown + daily budget + priority tier + oldest-first rotation
//   todayStr — the local-date key for the once-per-day gate
//
// Pure + testable; the React layer just runs work over whatever pickDue returns.

const DAY_MS = 86400000

// candidates: [{ key, tier, lastRun?, ...anything }] — lower tier = higher priority.
// meta: { [key]: { lastRun } } (per-key last-run timestamps, ms) — used when a
// candidate doesn't carry its own lastRun.
// Returns the ordered subset to run now (original fields preserved, minus lastRun).
export function pickDue(candidates, meta = {}, opts = {}) {
  const { cooldownMs = 7 * DAY_MS, budget = 3, now = Date.now() } = opts
  return candidates
    .map(c => ({ ...c, lastRun: c.lastRun ?? meta[c.key]?.lastRun ?? 0 }))
    .filter(c => !c.lastRun || now - c.lastRun > cooldownMs)     // per-key cooldown
    .sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || a.lastRun - b.lastRun) // priority, then oldest-run first (rotate)
    .slice(0, budget)                                           // cap spend
    .map(({ lastRun, ...keep }) => keep)
}

export const daysToMs = days => days * DAY_MS

// YYYY-MM-DD in local time — the once-per-day gate key.
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
