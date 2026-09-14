// Employer resolution — free-text company names (contacts.company,
// applications.company, event employer mentions) ↔ the canonical `employers`
// row. Wraps normalizeCompanyName() rather than replacing it: the 11 existing
// callers keep keying off the free-text column; this only adds the nullable
// employer_id alongside. Creation of new employer rows is service-role only
// (api/), so the client resolver is lookup-only and returns null on a miss.
import { normalizeCompanyName } from './networkGraph.js'

export function employerIndex(employers = []) {
  const byNorm = new Map()
  for (const e of employers) byNorm.set(e.normalizedName || normalizeCompanyName(e.name), e)
  return byNorm
}

export function resolveEmployer(name, employers = []) {
  if (!name) return null
  const index = employers instanceof Map ? employers : employerIndex(employers)
  return index.get(normalizeCompanyName(name)) || null
}

export function resolveEmployerId(name, employers = []) {
  return resolveEmployer(name, employers)?.id || null
}

// Employers this user already has a foothold at (a contact or an application),
// keyed by employer id — the relevance scorer's "warm employer" signal.
export function warmEmployerIds({ contacts = [], apps = [], employers = [] }) {
  const index = employerIndex(employers)
  const ids = new Set()
  for (const c of contacts) { const e = resolveEmployer(c.company, index); if (e) ids.add(e.id) }
  for (const a of apps) { const e = resolveEmployer(a.company, index); if (e) ids.add(e.id) }
  return ids
}
