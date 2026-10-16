import { describe, it, expect } from 'vitest'
import { boothRoute, planDay, captureDefaults } from '../src/lib/dayPlan.js'

const employers = [
  { id: 'e1', name: 'Stripe' }, { id: 'e2', name: 'Anthropic' }, { id: 'e3', name: 'Figma' },
  { id: 'e4', name: 'Ramp' }, { id: 'e5', name: 'Acme Corp' },
]
const fair = { id: 'ev1', title: 'Fall Fair', startsAt: '2026-10-22T14:00:00Z', endsAt: '2026-10-22T20:00:00Z', timezone: 'America/Detroit', attributes: { employerIds: ['e5', 'e3', 'e1', 'e2', 'e4'] } }
const ctx = {
  employers,
  targets: ['Figma'],
  apps: [{ company: 'Anthropic', stage: 'Technical' }, { company: 'Ramp', stage: 'Applied' }, { company: 'Acme', stage: 'Rejected' }],
  contacts: [{ name: 'Kelly Sanders', company: 'Stripe' }, { name: 'Ann Lee', company: 'Figma' }],
}

describe('boothRoute', () => {
  const route = boothRoute(fair, ctx)
  it('orders interviewing > applied > target > known contact > the rest', () => {
    expect(route.map(b => b.name)).toEqual(['Anthropic', 'Ramp', 'Figma', 'Stripe', 'Acme Corp'])
  })
  it('explains each stop and names who you know there', () => {
    expect(route[0].reasons).toContain('Technical stage')
    expect(route[2]).toMatchObject({ priority: 'target', contacts: ['Ann Lee'] })
    expect(route[3]).toMatchObject({ priority: 'contact', contacts: ['Kelly Sanders'] })
    expect(route[4]).toMatchObject({ priority: 'other', reasons: [] })
  })
  it('falls back to the host employer and ignores unknown ids', () => {
    expect(boothRoute({ employerId: 'e1', attributes: { employerIds: ['nope'] } }, ctx).map(b => b.name)).toEqual(['Stripe'])
    expect(boothRoute({ attributes: null }, ctx)).toEqual([])
  })
})

describe('planDay', () => {
  const route = boothRoute(fair, ctx)
  const at = (h, m = 0) => new Date(Date.UTC(2026, 9, 22, h, m)).toISOString()
  it('fills free windows in route order and reports what does not fit', () => {
    const fragments = [{ start: at(14), end: at(14, 25), minutes: 25 }, { start: at(16), end: at(16, 30), minutes: 30 }]
    const plan = planDay(route, fragments, { minutesPerBooth: 10 })
    expect(plan.blocks.map(b => b.booths.map(x => x.name))).toEqual([['Anthropic', 'Ramp'], ['Figma', 'Stripe', 'Acme Corp']])
    expect(plan.blocks[0].booths[1]).toMatchObject({ at: at(14, 10) })
    expect(plan.overflow).toEqual([])
  })
  it('overflows lowest-priority booths when time runs out, and skips windows too short for one booth', () => {
    const plan = planDay(route, [{ start: at(14), end: at(14, 5), minutes: 5 }, { start: at(15), end: at(15, 20), minutes: 20 }], { minutesPerBooth: 10 })
    expect(plan.blocks.map(b => b.booths.length)).toEqual([2])
    expect(plan.overflow.map(b => b.name)).toEqual(['Figma', 'Stripe', 'Acme Corp'])
  })
})

describe('captureDefaults', () => {
  it('dates the meeting on the event day (event timezone) and follows up 3 days later', () => {
    const late = { ...fair, startsAt: '2026-10-23T02:30:00Z' } // 22:30 on Oct 22 in Detroit
    expect(captureDefaults(late)).toEqual({ date: '2026-10-22', followUpDate: '2026-10-25', notes: 'Met at Fall Fair.' })
  })
})
