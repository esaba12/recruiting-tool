// Networking outcome flow for the Sankey (Network → Flow, and Today) — the networking
// twin of applicationFlow.js. Pure: contacts + interactions (+ calls) in, { nodes, links } out.
// Each contact you've actually been in touch with contributes one left-to-right path:
//
//   source (They reached out / Cold outreach / Intro / Event or chat / Other)
//     → [Conversation] → [Met] → [Referral asked] → outcome (Referral / Active / No reply / Gone cold)
//
// Contacts with no logged touchpoint at all are left out (same as Wishlist apps), and
// counted separately as `untouched`. Stages are inferred from the Interactions ledger:
// Conversation = both directions logged (or a call/meeting), Met = a call/meeting
// (interaction or call transcript), Referral asked = referralStatus moved off 'Not Asked'.
import { daysSince } from './dates.js'

export const SOURCES = ['They reached out', 'Cold outreach', 'Intro', 'Event or chat', 'Other']
export const NET_STAGES = ['Conversation', 'Met', 'Referral asked']
// Same slot order as applicationFlow's OUTCOMES (verdict, neutral, neutral, verdict) so it
// reuses the validated outcome palette in charts/theme.js — green never sits beside red.
export const NET_OUTCOMES = ['Referral', 'Active', 'No reply', 'Gone cold']
export const COLD_DAYS = 60

const MEETING_TYPES = new Set(['Call', 'Meeting'])
const SOURCE_MAP = {
  'Email': 'Cold outreach', 'LinkedIn DM': 'Cold outreach',
  'Referral': 'Intro', 'Coffee chat': 'Event or chat', 'Event': 'Event or chat',
}

const ts = i => Date.parse(i.sentAt || i.date || '') || 0

// Everything we know about one contact's history, in one pass.
export function contactSignals(contact, interactions = [], calls = []) {
  const mine = interactions.filter(i => i.contactId === contact.id).sort((a, b) => ts(a) - ts(b))
  const hasCall = calls.some(c => c.contactId === contact.id)
  const outbound = mine.some(i => i.direction === 'Outbound')
  const inbound = mine.some(i => i.direction === 'Inbound')
  const met = hasCall || mine.some(i => MEETING_TYPES.has(i.type))
  const dates = [...mine.map(ts), ...calls.filter(c => c.contactId === contact.id).map(c => Date.parse(c.date || '') || 0)]
  if (contact.lastInteraction) dates.push(Date.parse(contact.lastInteraction) || 0)
  const last = Math.max(0, ...dates)
  return {
    touched: mine.length > 0 || hasCall,
    firstDirection: mine[0]?.direction || null,
    outbound, inbound, met,
    conversation: met || (outbound && inbound),
    lastTouch: last ? new Date(last).toISOString().slice(0, 10) : null,
  }
}

export function sourceOf(contact, sig) {
  if (sig.firstDirection === 'Inbound') return 'They reached out'
  return SOURCE_MAP[contact.source] || 'Other'
}

export function netOutcomeOf(contact, sig, now = Date.now()) {
  if (contact.referralStatus === 'Confirmed') return 'Referral'
  if (!sig.conversation) return 'No reply'
  if (['🔴 Cold', '✅ Closed'].includes(contact.status)) return 'Gone cold'
  const quiet = sig.lastTouch ? daysSince(sig.lastTouch, now) : null
  if (quiet !== null && quiet > COLD_DAYS && contact.status !== '⭐ Champion') return 'Gone cold'
  return 'Active'
}

export function netFlowPath(contact, interactions, calls, now = Date.now()) {
  const sig = contactSignals(contact, interactions, calls)
  if (!sig.touched) return null
  // An inbound-first contact we never answered is still "they reached out → no reply" —
  // conversation needs both sides, so the path stays honest either way.
  const path = [sourceOf(contact, sig)]
  if (sig.conversation) path.push('Conversation')
  if (sig.met) path.push('Met')
  if (contact.referralStatus && contact.referralStatus !== 'Not Asked') path.push('Referral asked')
  path.push(netOutcomeOf(contact, sig, now))
  return path
}

const NODE_ORDER = [...SOURCES, ...NET_STAGES, ...NET_OUTCOMES]
const KIND = name => SOURCES.includes(name) ? 'source' : NET_OUTCOMES.includes(name) ? 'outcome' : 'stage'

// Same { nodes, links } shape as buildApplicationFlow, with `appIds` carrying contact ids so
// SankeyChart's onSelect works unchanged.
export function buildNetworkingFlow(contacts, interactions = [], calls = [], now = Date.now()) {
  const linkMap = new Map()
  const nodeIds = new Map()
  let total = 0, untouched = 0
  for (const c of contacts || []) {
    const path = netFlowPath(c, interactions, calls, now)
    if (!path) { untouched++; continue }
    total++
    for (const n of path) {
      if (!nodeIds.has(n)) nodeIds.set(n, [])
      nodeIds.get(n).push(c.id)
    }
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`
      if (!linkMap.has(key)) linkMap.set(key, { source: path[i], target: path[i + 1], appIds: [] })
      linkMap.get(key).appIds.push(c.id)
    }
  }
  const names = NODE_ORDER.filter(n => nodeIds.has(n))
  const index = new Map(names.map((n, i) => [n, i]))
  const nodes = names.map(name => ({ name, kind: KIND(name), value: nodeIds.get(name).length, appIds: nodeIds.get(name) }))
  const links = [...linkMap.values()]
    .map(l => ({ ...l, source: index.get(l.source), target: index.get(l.target), value: l.appIds.length }))
    .sort((a, b) => a.source - b.source || a.target - b.target)
  return { nodes, links, total, untouched }
}

export function networkingSummary(flow) {
  const by = new Map(flow.nodes.map(n => [n.name, n.value]))
  return {
    contacted: flow.total,
    replyRate: flow.total ? Math.round(((by.get('Conversation') || 0) / flow.total) * 100) : 0,
    met: by.get('Met') || 0,
    asked: by.get('Referral asked') || 0,
    referrals: by.get('Referral') || 0,
    noReply: by.get('No reply') || 0,
  }
}
