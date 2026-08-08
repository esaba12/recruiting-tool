// Warm-intro path-finding over data the app already stores — no new scraping, no new
// fields. Three distinct signals, all cheap:
//
// 1. Referral chains: Contacts.referredById is a self-relation ("who introduced this
//    contact to you"). Walking it to full depth (not just one hop) surfaces the real
//    provenance behind a relationship — e.g. discovering you have a 2-hop path into a
//    company via a friend-of-a-friend you'd forgotten was connected. True graph
//    traversal, since every edge here is real, already-stored data.
// 2. Tagged relationships: contact_relationships (Mentor Of, College Friend Of, etc.)
//    are additional real edges between two contacts — generalizes (1) from a single
//    referral chain into a proper graph, so e.g. "Bob is Alice's college friend" can
//    complete a path that no referral alone would surface.
// 3. Possible connections: for a *stranger* Discover surfaces (no edges to them exist —
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

// Undirected adjacency over contacts, from both referredById edges and contact_relationships
// edges — for warm-intro purposes, any recorded connection between two contacts is a usable
// path segment regardless of its direction or type ("Bob mentors Alice" is just as good a
// link to walk as "Alice referred Bob" when you're looking for a way to reach Bob).
function buildAdjacency(contacts, relationships) {
  const adj = new Map()
  const link = (a, b) => {
    if (!a || !b || a === b) return
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a).add(b)
    adj.get(b).add(a)
  }
  contacts.forEach(c => { if (c.referredById) link(c.referredById, c.id) })
  relationships.forEach(r => link(r.fromContactId, r.toContactId))
  return adj
}

// Shortest path (by hop count, BFS) from `contact` back to the nearest contact you know
// directly (one with no referrer) — walking both referral and tagged-relationship edges.
// Generalizes referralChainFor to a real graph; falls back to it unchanged when no
// relationships are supplied (existing callers/behavior untouched).
export function shortestPathTo(contact, contacts, relationships = []) {
  if (!relationships.length) return referralChainFor(contact, contacts)

  const byId = new Map(contacts.map(c => [c.id, c]))
  const adj = buildAdjacency(contacts, relationships)
  const rootIds = new Set(contacts.filter(c => !c.referredById).map(c => c.id))
  if (rootIds.has(contact.id)) return []

  const visited = new Set([contact.id])
  const prev = new Map()
  const queue = [contact.id]
  let foundRoot = null
  while (queue.length) {
    const cur = queue.shift()
    if (cur !== contact.id && rootIds.has(cur)) { foundRoot = cur; break }
    for (const next of adj.get(cur) || []) {
      if (!visited.has(next)) {
        visited.add(next)
        prev.set(next, cur)
        queue.push(next)
      }
    }
  }
  if (foundRoot === null) return referralChainFor(contact, contacts) // no reachable root via the graph — same (possibly empty) result as before

  const path = []
  let cur = foundRoot
  while (cur !== contact.id) {
    path.push(byId.get(cur))
    cur = prev.get(cur)
  }
  return path.reverse() // nearest-to-contact first, root last — same order as referralChainFor's chain
}

// Every contact at `company`, with their shortest path back to someone you know directly —
// shortest (most direct) path first, since that's the person most worth leaning on for
// context or a re-intro. Uses shortestPathTo (referral chains + tagged relationships) when
// relationships are supplied, else the original referral-only chain.
export function warmPathsToCompany(contacts, company, relationships = []) {
  const key = normalizeCompanyName(company)
  return contacts
    .filter(c => c.company?.trim() && normalizeCompanyName(c.company) === key)
    .map(c => ({ contact: c, chain: shortestPathTo(c, contacts, relationships) }))
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
