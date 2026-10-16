// Application outcome flow for the Sankey (Pipeline → Sheet → Flow, and Today).
// Pure: apps in, { nodes, links } out. Each app contributes one left-to-right path:
//
//   source (Job board / Referral / Direct) → Applied → [OA] → interview stages it
//   reached, in pipeline order → outcome (Accepted / Rejected / Ghosted / In process)
//
// Wishlist rows never applied, so they're left out. Stage history comes from
// stagePath(), which keeps first visits only — a correction that moved a card
// backward can't create a cycle. Interview stages are re-sorted into pipeline order
// for the same reason (a Sankey must be acyclic).
import { appSource } from './applicationSheet.js'
import { stagePath } from './stageHistory.js'
import { daysSince } from './dates.js'

export const FLOW_STAGES = ['Phone Screen', 'Technical', 'Onsite', 'Offer']
// Accepted and Rejected are kept apart by the two neutrals so green never sits beside red
// (deutan ΔE 5.3 when adjacent; see charts/SankeyChart.jsx).
export const OUTCOMES = ['Accepted', 'In process', 'Ghosted', 'Rejected']
export const GHOST_DAYS = 30

export function hadOA(app) {
  return !!(app.oaDueDate || app.oaLink || app.oaCompleted)
}

// Still open, but nothing has happened for GHOST_DAYS. An Offer that's sitting is the
// student's move, not the company's, so it never counts as ghosted.
export function isGhosted(app, now = Date.now()) {
  if (['Accepted', 'Rejected', 'Offer', 'Wishlist'].includes(app.stage)) return false
  const last = [app.lastActivity, app.stageChangedAt, app.appliedDate].filter(Boolean).sort().pop()
  if (!last) return false
  const d = daysSince(last, now)
  return d !== null && d > GHOST_DAYS
}

export function outcomeOf(app, now = Date.now()) {
  if (app.stage === 'Accepted') return 'Accepted'
  if (app.stage === 'Rejected') return 'Rejected'
  return isGhosted(app, now) ? 'Ghosted' : 'In process'
}

export function flowPath(app, now = Date.now()) {
  if (!app.stage || app.stage === 'Wishlist') return null
  const visited = new Set(stagePath(app))
  const path = [appSource(app), 'Applied']
  if (hadOA(app)) path.push('OA')
  for (const s of FLOW_STAGES) if (visited.has(s)) path.push(s)
  path.push(outcomeOf(app, now))
  return path
}

const NODE_ORDER = ['Job board', 'Referral', 'Direct', 'Applied', 'OA', ...FLOW_STAGES, ...OUTCOMES]
const KIND = name =>
  ['Job board', 'Referral', 'Direct'].includes(name) ? 'source'
    : OUTCOMES.includes(name) ? 'outcome' : 'stage'

// links carry appIds (so clicking a band can filter the sheet) and how many of those
// apps had estimated history — an estimated Rejected app may really have been
// rejected after a phone screen, the backfill just can't know.
export function buildApplicationFlow(apps, now = Date.now()) {
  const linkMap = new Map()
  const nodeApps = new Map()
  let total = 0, estimated = 0
  for (const app of apps || []) {
    const path = flowPath(app, now)
    if (!path) continue
    total++
    if (app.historyEstimated) estimated++
    for (const n of path) {
      if (!nodeApps.has(n)) nodeApps.set(n, [])
      nodeApps.get(n).push(app.id)
    }
    for (let i = 0; i < path.length - 1; i++) {
      const key = `${path[i]}→${path[i + 1]}`
      if (!linkMap.has(key)) linkMap.set(key, { source: path[i], target: path[i + 1], appIds: [], estimated: 0 })
      const l = linkMap.get(key)
      l.appIds.push(app.id)
      if (app.historyEstimated) l.estimated++
    }
  }
  const names = NODE_ORDER.filter(n => nodeApps.has(n))
  const index = new Map(names.map((n, i) => [n, i]))
  const nodes = names.map(name => ({ name, kind: KIND(name), value: nodeApps.get(name).length, appIds: nodeApps.get(name) }))
  const links = [...linkMap.values()]
    .map(l => ({ ...l, source: index.get(l.source), target: index.get(l.target), value: l.appIds.length }))
    .sort((a, b) => a.source - b.source || a.target - b.target)
  return { nodes, links, total, estimated }
}

// "Applied → Phone Screen: 12 of 80 (15%)" style headline numbers for the caption.
export function flowSummary(flow) {
  const byName = new Map(flow.nodes.map(n => [n.name, n.value]))
  const interviewed = new Set(flow.nodes.filter(n => FLOW_STAGES.includes(n.name)).flatMap(n => n.appIds)).size
  return {
    applied: flow.total,
    interviewed,
    offers: byName.get('Offer') || 0,
    rejected: byName.get('Rejected') || 0,
    ghosted: byName.get('Ghosted') || 0,
    open: byName.get('In process') || 0,
    responseRate: flow.total ? Math.round(((flow.total - (byName.get('Ghosted') || 0) - countStuckApplied(flow)) / flow.total) * 100) : 0,
  }
}

// Apps that went straight from Applied to "In process" — no answer of any kind yet
// (an OA invite counts as an answer).
function countStuckApplied(flow) {
  const idx = new Map(flow.nodes.map((n, i) => [n.name, i]))
  const inProcess = idx.get('In process')
  if (inProcess === undefined) return 0
  return flow.links
    .filter(l => l.target === inProcess && flow.nodes[l.source].name === 'Applied')
    .reduce((s, l) => s + l.value, 0)
}
