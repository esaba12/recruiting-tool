// Per-user relevance for shared events — a PRE-attendance scorer over signals
// the app already has: the user's profile (focus), target companies, active
// applications, contacts, and the event's shared attributes. Pure + testable;
// the React layer persists results via db.upsertEventRelevanceMany keyed by an
// input hash so an unchanged (profile, targets, event) never re-writes a row.
//
// Staleness rule from the brief: an event whose source hasn't been re-verified
// in 14 days can't be upgraded — its tier is capped at 'medium' no matter the score.
import { hashText } from './ingest/hashGate.js'
import { isStale } from './ingest/freshness.js'
import { normalizeCompanyName } from './networkGraph.js'

export const TIER_ORDER = { high: 3, medium: 2, low: 1 }
const DAY = 86400000

const KIND_BASE = { career_fair: 2, coffee_chat: 1.5, info_session: 1, networking: 1, workshop: 0.5, other: 0 }
const FOCUS_ROLES = { SWE: ['SWE'], PM: ['PM'], Both: ['SWE', 'PM'] }

export function tierFor(score) {
  if (score >= 6) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

// ctx: { profile: { focus }, targets: string[], contacts, apps, employers, now }
export function scoreEvent(event, ctx = {}) {
  const now = ctx.now ?? Date.now()
  const start = Date.parse(event.startsAt)
  if (!Number.isNaN(start) && start < now - DAY) return { score: 0, tier: 'low', reason: 'Already happened', stale: false }

  const reasons = []
  let score = KIND_BASE[event.kind] ?? 0
  if (score >= 2) reasons.push('career fair')

  // Employer signals — host employer (feed's employer_id or the extracted one)
  // vs. what the user cares about; multi-employer fairs credit attending targets.
  const employerName = new Map((ctx.employers || []).map(e => [e.id, e.name]))
  const hostNames = new Set()
  if (event.employerId && employerName.has(event.employerId)) hostNames.add(normalizeCompanyName(employerName.get(event.employerId)))
  if (event.attributes?.employer) hostNames.add(normalizeCompanyName(event.attributes.employer))
  const targets = new Set((ctx.targets || []).map(normalizeCompanyName))
  const appliedTo = new Set((ctx.apps || []).filter(a => a.company && a.stage !== 'Rejected').map(a => normalizeCompanyName(a.company)))
  const known = new Set((ctx.contacts || []).filter(c => c.company).map(c => normalizeCompanyName(c.company)))

  if (hostNames.size) {
    let hit = false
    for (const n of hostNames) {
      if (targets.has(n)) { score += 3; reasons.push('target company'); hit = true }
      if (appliedTo.has(n)) { score += 3; reasons.push('active application'); hit = true }
      if (known.has(n)) { score += 2; reasons.push('you know someone there'); hit = true }
    }
    if (!hit) score += 0.5
  }
  const attending = (event.attributes?.employerIds || []).map(id => employerName.get(id)).filter(Boolean).map(normalizeCompanyName)
    .filter(n => !hostNames.has(n))
  const matched = attending.filter(n => targets.has(n) || appliedTo.has(n))
  if (matched.length) { score += Math.min(4, 1.5 * matched.length); reasons.push(`${matched.length} target employer${matched.length > 1 ? 's' : ''} attending`) }

  // Role fit.
  const roles = event.attributes?.roles || []
  const wanted = FOCUS_ROLES[ctx.profile?.focus] || FOCUS_ROLES.Both
  if (roles.length) {
    if (roles.some(r => wanted.includes(r))) { score += 2; reasons.push(`${wanted.join('/')} roles`) }
    else { score -= 2; reasons.push('other role families') }
  }

  // Timing: nearer events matter more.
  if (!Number.isNaN(start)) {
    const days = (start - now) / DAY
    if (days <= 3) { score += 1.5; reasons.push('this week') }
    else if (days <= 14) { score += 1; reasons.push('within 2 weeks') }
  }
  if (event.registrationDeadline && Date.parse(event.registrationDeadline) > now && Date.parse(event.registrationDeadline) - now < 7 * DAY) {
    score += 1; reasons.push('registration closes soon')
  }

  let tier = tierFor(score)
  const stale = isStale(event.sourceLastVerifiedAt, { now })
  if (stale && tier === 'high') { tier = 'medium'; reasons.unshift('source unverified >14d') }

  return { score: Math.round(score * 10) / 10, tier, reason: reasons.slice(0, 5).join(' · ') || 'General campus event', stale }
}

// Hash of everything the score depends on, so persisted rows are only rewritten on change.
export function relevanceInputHash(event, ctx = {}) {
  return hashText(JSON.stringify({
    e: [event.id, event.kind, event.startsAt, event.employerId, event.registrationDeadline, event.sourceLastVerifiedAt?.slice(0, 10), event.attributes?.roles, event.attributes?.employerIds, event.attributes?.employer],
    p: ctx.profile?.focus || null,
    t: [...(ctx.targets || [])].map(normalizeCompanyName).sort(),
    a: [...new Set((ctx.apps || []).map(a => normalizeCompanyName(a.company || '')))].sort(),
    c: [...new Set((ctx.contacts || []).map(c => normalizeCompanyName(c.company || '')))].sort(),
    d: new Date(ctx.now ?? Date.now()).toISOString().slice(0, 10),   // timing bonuses shift daily
  }))
}

// events + existing relevance rows → rows that need (re)writing, plus the merged view.
export function computeRelevance(events, ctx = {}, existing = []) {
  const byEvent = new Map(existing.map(r => [r.eventId, r]))
  const writes = []
  const view = new Map()
  for (const ev of events) {
    const prev = byEvent.get(ev.id)
    const inputHash = relevanceInputHash(ev, ctx)
    let row = prev
    if (!prev || prev.inputHash !== inputHash) {
      const s = scoreEvent(ev, ctx)
      row = { ...(prev || {}), eventId: ev.id, score: s.score, tier: s.tier, reason: s.reason, inputHash, computedAt: new Date(ctx.now ?? Date.now()).toISOString() }
      writes.push({ eventId: ev.id, score: s.score, tier: s.tier, reason: s.reason, inputHash, computedAt: row.computedAt })
    }
    view.set(ev.id, row)
  }
  return { writes, view }
}

export function effectiveTier(rel) {
  if (!rel) return 'low'
  if (rel.dismissedAt) return 'dismissed'
  return rel.overrideTier || rel.tier || 'low'
}

export function sortByRelevance(events, view) {
  const rank = ev => { const t = effectiveTier(view.get(ev.id)); return t === 'dismissed' ? 0 : TIER_ORDER[t] || 0 }
  return [...events].sort((a, b) => rank(b) - rank(a) || (view.get(b.id)?.score || 0) - (view.get(a.id)?.score || 0) || Date.parse(a.startsAt) - Date.parse(b.startsAt))
}
