// Today's instrument-panel stat tiles (STAT-01) — small, presentation-adjacent derivations
// built entirely on data pipelines the app already maintains (no new Supabase queries, no
// new AI calls). This module owns the Next Deadline tile's cross-reference logic; the Funnel
// and Activity tiles derive their numbers directly from data ActivitySection already computes,
// so they don't need a helper here.
import { lsGet, jobId, daysUntilDeadline } from '../components/jobBoards/helpers.js'

const DEADLINE_KEY = 'rec_job_deadlines'

// Cross-references Pipeline apps against the rec_job_deadlines cache (same cache
// useJobDeadlines.js writes to, keyed by jobId({company, role})) to find applications with
// a real, confirmed deadline that haven't been acted on yet.
//
// Intentionally narrower than lib/timeline.js's own deadline cross-reference (which excludes
// Needs-Review apps via !isUntriaged) — D-07 wants "applications you haven't yet acted on,"
// the opposite scope: only Needs-Review/Applying apps with a Source Repo qualify.
//
// Never fabricates a deadline for a missing/rolling entry — daysUntilDeadline() already
// returns null for an entry lacking `.deadline`, and those are filtered out before sorting.
// Already-passed deadlines (days < 0) are filtered out too, so the tile never renders a
// misleading negative countdown for an application that's already missed its window.
// Returns an empty array (never null/undefined) when nothing matches, so the caller can
// treat "no entries" as the fail-soft "no known deadlines" case.
export function nextDeadlines(apps, limit = 3) {
  const cache = lsGet(DEADLINE_KEY) || {}

  const candidates = (apps || []).filter(a => a.sourceRepo && (a.triage === 'Needs Review' || a.triage === 'Applying'))

  const matches = []
  for (const a of candidates) {
    const info = cache[jobId({ company: a.company, role: a.role })]
    if (!info?.deadline) continue
    const days = daysUntilDeadline(info)
    if (days === null || days < 0) continue
    matches.push({ company: a.company, role: a.role, deadline: info.deadline, days })
  }

  matches.sort((x, y) => x.days - y.days)
  return matches.slice(0, limit)
}
