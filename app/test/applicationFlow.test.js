import { describe, it, expect } from 'vitest'
import { flowPath, outcomeOf, isGhosted, buildApplicationFlow, flowSummary } from '../src/lib/applicationFlow.js'

const NOW = new Date('2026-10-16T12:00:00').getTime()
const ev = (from, to, at, source = 'user') => ({ fromStage: from, toStage: to, changedAt: at, source })

describe('flowPath', () => {
  it('skips Wishlist entirely', () => {
    expect(flowPath({ id: 'w', stage: 'Wishlist' }, NOW)).toBe(null)
  })
  it('walks source → Applied → OA → visited interview stages → outcome', () => {
    const app = {
      id: 'a', stage: 'Rejected', referredById: 'c1', oaDueDate: '2026-09-10',
      stageEvents: [ev(null, 'Applied', '2026-09-01'), ev('Applied', 'Phone Screen', '2026-09-20'), ev('Phone Screen', 'Rejected', '2026-10-01')],
    }
    expect(flowPath(app, NOW)).toEqual(['Referral', 'Applied', 'OA', 'Phone Screen', 'Rejected'])
  })
  it('keeps interview stages in pipeline order even after a backward correction', () => {
    const app = {
      id: 'b', stage: 'Phone Screen', sourceRepo: 'x/y', lastActivity: '2026-10-14',
      stageEvents: [ev(null, 'Applied', '2026-09-01'), ev('Applied', 'Onsite', '2026-10-01'), ev('Onsite', 'Phone Screen', '2026-10-02')],
    }
    expect(flowPath(app, NOW)).toEqual(['Job board', 'Applied', 'Phone Screen', 'Onsite', 'In process'])
  })
  it('an offer accepted runs through Offer to Accepted', () => {
    const app = { id: 'c', stage: 'Accepted', stageEvents: [ev(null, 'Applied', '2026-08-01'), ev('Applied', 'Offer', '2026-09-01'), ev('Offer', 'Accepted', '2026-09-05')] }
    expect(flowPath(app, NOW)).toEqual(['Direct', 'Applied', 'Offer', 'Accepted'])
  })
})

describe('outcomes', () => {
  it('ghosts open apps quiet for more than 30 days, never offers', () => {
    expect(isGhosted({ stage: 'Applied', appliedDate: '2026-09-01' }, NOW)).toBe(true)
    expect(isGhosted({ stage: 'Applied', appliedDate: '2026-09-01', lastActivity: '2026-10-10' }, NOW)).toBe(false)
    expect(isGhosted({ stage: 'Offer', appliedDate: '2026-01-01' }, NOW)).toBe(false)
    expect(isGhosted({ stage: 'Applied' }, NOW)).toBe(false)
  })
  it('maps terminal stages straight through', () => {
    expect(outcomeOf({ stage: 'Rejected' }, NOW)).toBe('Rejected')
    expect(outcomeOf({ stage: 'Accepted' }, NOW)).toBe('Accepted')
    expect(outcomeOf({ stage: 'Technical', lastActivity: '2026-10-15' }, NOW)).toBe('In process')
  })
})

describe('buildApplicationFlow', () => {
  const apps = [
    { id: '1', stage: 'Rejected', historyEstimated: true, stageEvents: [ev(null, 'Applied', '2026-09-01', 'backfill'), ev('Applied', 'Rejected', '2026-09-20', 'backfill')] },
    { id: '2', stage: 'Rejected', stageEvents: [ev(null, 'Applied', '2026-09-01'), ev('Applied', 'Rejected', '2026-09-22')] },
    { id: '3', stage: 'Phone Screen', lastActivity: '2026-10-15', stageEvents: [ev(null, 'Applied', '2026-09-01'), ev('Applied', 'Phone Screen', '2026-10-15')] },
    { id: '4', stage: 'Applied', appliedDate: '2026-08-01', stageEvents: [ev(null, 'Applied', '2026-08-01')] },
    { id: '5', stage: 'Applied', appliedDate: '2026-10-14', stageEvents: [ev(null, 'Applied', '2026-10-14')] },
    { id: '6', stage: 'Wishlist' },
  ]
  const flow = buildApplicationFlow(apps, NOW)
  const name = i => flow.nodes[i].name
  const link = (s, t) => flow.links.find(l => name(l.source) === s && name(l.target) === t)

  it('counts each applied app once and ignores Wishlist', () => {
    expect(flow.total).toBe(5)
    expect(flow.estimated).toBe(1)
    expect(flow.nodes.find(n => n.name === 'Applied').value).toBe(5)
  })
  it('emits only nodes that carry flow, in a stable left-to-right order', () => {
    expect(flow.nodes.map(n => n.name)).toEqual(['Direct', 'Applied', 'Phone Screen', 'In process', 'Ghosted', 'Rejected'])
  })
  it('aggregates links with app ids and estimated counts', () => {
    expect(link('Applied', 'Rejected')).toMatchObject({ value: 2, estimated: 1, appIds: ['1', '2'] })
    expect(link('Applied', 'Ghosted')).toMatchObject({ value: 1, appIds: ['4'] })
    expect(link('Phone Screen', 'In process').value).toBe(1)
  })
  it('conserves flow through every middle node', () => {
    flow.nodes.forEach((n, i) => {
      const inflow = flow.links.filter(l => l.target === i).reduce((s, l) => s + l.value, 0)
      const outflow = flow.links.filter(l => l.source === i).reduce((s, l) => s + l.value, 0)
      if (inflow && outflow) expect(inflow, n.name).toBe(outflow)
    })
  })
  it('summarizes the headline numbers', () => {
    expect(flowSummary(flow)).toEqual({ applied: 5, interviewed: 1, offers: 0, rejected: 2, ghosted: 1, open: 2, responseRate: 60 })
  })
  it('handles nothing at all', () => {
    expect(buildApplicationFlow([], NOW)).toEqual({ nodes: [], links: [], total: 0, estimated: 0 })
    expect(flowSummary(buildApplicationFlow([], NOW)).responseRate).toBe(0)
  })
})
