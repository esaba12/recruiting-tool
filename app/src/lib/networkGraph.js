export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Canonical company key (trim + lowercase) — also used by ReferralCoverageTab.jsx to
// cross-reference a target-company list against Contacts/Applications, so it stays the
// one normalization function rather than a 3rd near-duplicate (shared.jsx's
// findDuplicateGroups has its own Company+Role key, separately).
export function normalizeCompanyName(name) {
  return name.trim().toLowerCase()
}

// relationships: contact_relationships rows ({fromContactId, toContactId, relationshipType}),
// additive alongside the existing works-at/referred-by edges derived from contacts alone.
export function buildGraph(contacts, relationships = []) {
  const nodes = []
  const links = []
  const companyId = (name) => `company:${normalizeCompanyName(name)}`
  const seenCompanies = new Set()

  contacts.forEach(c => {
    nodes.push({ id: c.id, kind: 'contact', label: c.name, contact: c })
    if (c.company?.trim()) {
      const cid = companyId(c.company)
      if (!seenCompanies.has(cid)) {
        seenCompanies.add(cid)
        nodes.push({ id: cid, kind: 'company', label: c.company.trim() })
      }
      links.push({ source: c.id, target: cid, kind: 'works-at' })
    }
    if (c.referredById) {
      links.push({ source: c.referredById, target: c.id, kind: 'referred-by' })
    }
  })

  relationships.forEach(r => {
    links.push({ source: r.fromContactId, target: r.toContactId, kind: r.relationshipType, label: r.relationshipType })
  })

  return { nodes, links }
}
