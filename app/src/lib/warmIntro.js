// Warm-intro path-finding over data the app already stores — no new scraping, no new
// fields. Two distinct signals, both cheap:
//
// 1. Referral chains: Contacts.referredById is a self-relation ("who introduced this
//    contact to you"). Walking it to full depth (not just one hop) surfaces the real
//    provenance behind a relationship — e.g. discovering you have a 2-hop path into a
//    company via a friend-of-a-friend you'd forgotten was connected. True graph
//    traversal, since every edge here is real, already-stored data.
// 2. Possible connections: for a *stranger* Discover surfaces (no edges to them exist —
//    Exa's search index doesn't tell us who they know), the closest honest proxy is
//    shared-employer overlap with someone already in your Contacts. Not a literal path,
//    but a legitimate "ask X, they might have context" signal.
import { normalizeCompanyName } from './networkGraph.js'

// Nearest-first ancestry for one contact: [who referred them, who referred that person, ...].
// Stops at a missing link or a cycle (shouldn't happen via the UI, but self-relations from
// any future bulk-import path aren't guaranteed acyclic).
export function referralChainFor(contact, contacts) {
  const byId = new Map(contacts.map(c => [c.id, c]))
  const chain = []
  const seen = new Set([contact.id])
  let current = contact
  while (current.referredById && byId.has(current.referredById) && !seen.has(current.referredById)) {
    const next = byId.get(current.referredById)
    chain.push(next)
    seen.add(next.id)
    current = next
  }
  return chain
}

// Every contact at `company`, with their full referral chain — shortest (most direct)
// path first, since that's the person most worth leaning on for context or a re-intro.
export function warmPathsToCompany(contacts, company) {
  const key = normalizeCompanyName(company)
  return contacts
    .filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
    .map(c => ({ contact: c, chain: referralChainFor(c, contacts) }))
    .sort((a, b) => a.chain.length - b.chain.length)
}

// Root-to-contact display order, e.g. "Alice → Bob → Carol" for a chain where Bob
// referred Carol and Alice referred Bob.
export function pathLabel(path) {
  return [...path.chain].reverse().map(c => c.name).concat(path.contact.name).join(' → ')
}

// First existing contact whose current company overlaps with a Discover candidate's
// employment history (excluding the target company itself, which is already covered by
// discoveryScore's "existing contacts at this company" logic) — or null.
export function possibleConnectionFor(person, contacts) {
  const targetKey = normalizeCompanyName(person.company || '')
  const strangerPast = new Set((person.pastCompanies || []).map(normalizeCompanyName).filter(Boolean))
  if (strangerPast.size === 0) return null
  return contacts.find(c => {
    if (!c.company?.trim()) return false
    const key = normalizeCompanyName(c.company)
    return key !== targetKey && strangerPast.has(key)
  }) || null
}
