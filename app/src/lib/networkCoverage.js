import { normalizeCompanyName } from './networkGraph.js'
import { affinityScore } from './affinity.js'

// Shared "do I have network at this company?" signal — used by both Coverage (against
// the target-company list) and Pipeline (against actual applications). A company where
// your only contact is a total stranger you added but never talked to isn't meaningfully
// covered, so this buckets on affinityScore (tie strength + affinity tags), not just
// "any contact at all".
export const STRONG_COVERAGE_THRESHOLD = 3

export function companyCoverage(company, contacts, interactions) {
  const trimmed = (company || '').trim()
  if (!trimmed) return { status: 'none', matchedContacts: [], bestScore: -1 }
  const key = normalizeCompanyName(trimmed)
  const matchedContacts = contacts.filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
  const bestScore = matchedContacts.length > 0 ? Math.max(...matchedContacts.map(c => affinityScore(c, interactions))) : -1
  const status = matchedContacts.length === 0 ? 'gap' : bestScore >= STRONG_COVERAGE_THRESHOLD ? 'strong' : 'weak'
  return { status, matchedContacts, bestScore }
}
