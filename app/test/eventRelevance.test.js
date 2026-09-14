import { describe, it, expect } from 'vitest'
import { scoreEvent, computeRelevance, effectiveTier, sortByRelevance, relevanceInputHash } from '../src/lib/eventRelevance.js'
import { eventRequirementsDue, registrationClosingSoon, eventFollowUpsOverdue, degradedEventSources } from '../src/lib/attention.js'

const DAY = 86400000
const now = Date.parse('2026-09-14T12:00:00Z')
const iso = d => new Date(now + d * DAY).toISOString()
const employers = [{ id: 'e1', name: 'Stripe', normalizedName: 'stripe' }, { id: 'e2', name: 'AbbVie', normalizedName: 'abbvie' }]
const ctx = { now, profile: { focus: 'SWE' }, targets: ['Stripe'], apps: [{ company: 'stripe', stage: 'Applied' }], contacts: [{ company: 'Stripe' }], employers }
const base = { id: 'ev', kind: 'info_session', startsAt: iso(10), sourceLastVerifiedAt: iso(-1), attributes: null, employerId: null }

describe('scoreEvent', () => {
  it('stacks employer signals: target + applied + known contact', () => {
    const r = scoreEvent({ ...base, employerId: 'e1', attributes: { roles: ['SWE'] } }, ctx)
    expect(r.tier).toBe('high')
    expect(r.reason).toMatch(/target company/)
    expect(r.reason).toMatch(/active application/)
    expect(r.reason).toMatch(/know someone/)
  })
  it('penalizes an off-focus role family and rewards fairs', () => {
    expect(scoreEvent({ ...base, employerId: 'e2', attributes: { roles: ['Hardware'] } }, ctx).tier).toBe('low')
    const fair = scoreEvent({ ...base, kind: 'career_fair', attributes: { roles: [], employerIds: ['e1'] } }, ctx)
    expect(fair.reason).toMatch(/1 target employer attending/)
  })
  it('never upgrades a stale event past medium', () => {
    const fresh = scoreEvent({ ...base, employerId: 'e1', attributes: { roles: ['SWE'] } }, ctx)
    const stale = scoreEvent({ ...base, employerId: 'e1', attributes: { roles: ['SWE'] }, sourceLastVerifiedAt: iso(-20) }, ctx)
    expect(fresh.tier).toBe('high')
    expect(stale.tier).toBe('medium')
    expect(stale.stale).toBe(true)
    expect(stale.reason).toMatch(/unverified/)
  })
  it('zeroes events that already happened', () => {
    expect(scoreEvent({ ...base, startsAt: iso(-3), employerId: 'e1' }, ctx)).toMatchObject({ score: 0, tier: 'low' })
  })
  it('adds timing and registration-closing-soon bonuses', () => {
    const soon = scoreEvent({ ...base, startsAt: iso(2), registrationDeadline: iso(1) }, ctx)
    expect(soon.reason).toMatch(/this week/)
    expect(soon.reason).toMatch(/registration closes soon/)
  })
})

describe('computeRelevance + tiers', () => {
  it('only writes rows whose input hash changed, and keeps overrides/dismissals', () => {
    const events = [{ ...base, id: 'a', employerId: 'e1', attributes: { roles: ['SWE'] } }, { ...base, id: 'b' }]
    const first = computeRelevance(events, ctx, [])
    expect(first.writes.length).toBe(2)
    const existing = first.writes.map(w => ({ ...w, overrideTier: w.eventId === 'b' ? 'high' : null, dismissedAt: null }))
    const second = computeRelevance(events, ctx, existing)
    expect(second.writes.length).toBe(0)
    expect(effectiveTier(second.view.get('b'))).toBe('high')
    const third = computeRelevance(events, { ...ctx, targets: [] }, existing)
    expect(third.writes.map(w => w.eventId)).toContain('a')
    expect(effectiveTier({ ...second.view.get('a'), dismissedAt: iso(0) })).toBe('dismissed')
  })
  it('sortByRelevance ranks by effective tier, then score, then date', () => {
    const events = [{ ...base, id: 'low' }, { ...base, id: 'hi', employerId: 'e1', attributes: { roles: ['SWE'] } }, { ...base, id: 'dis', employerId: 'e1' }]
    const { view } = computeRelevance(events, ctx, [{ eventId: 'dis', dismissedAt: iso(0), inputHash: 'x' }])
    view.set('dis', { ...view.get('dis'), dismissedAt: iso(0) })
    expect(sortByRelevance(events, view).map(e => e.id)).toEqual(['hi', 'low', 'dis'])
  })
  it('input hash shifts with the day (timing bonuses) and with targets', () => {
    const h1 = relevanceInputHash(base, ctx)
    expect(relevanceInputHash(base, { ...ctx, now: now + DAY })).not.toBe(h1)
    expect(relevanceInputHash(base, { ...ctx, targets: ['Ramp'] })).not.toBe(h1)
    expect(relevanceInputHash(base, { ...ctx, targets: ['stripe '] })).toBe(h1)
  })
})

describe('attention derivations', () => {
  const events = [
    { id: 'fair', kind: 'career_fair', title: 'Fair', startsAt: iso(9), registrationDeadline: iso(4), requirements: [
      { id: 'r1', stepOrder: 1, kind: 'register', required: true, dueAt: iso(4) },
      { id: 'r2', stepOrder: 2, kind: 'upload_resume', required: true, dueAt: iso(-1) },
    ] },
    { id: 'past', kind: 'workshop', title: 'Past', startsAt: iso(-2), requirements: [{ id: 'r9', stepOrder: 1, kind: 'register', required: true, dueAt: iso(-3) }] },
    { id: 'skip', kind: 'info_session', title: 'Skipped', startsAt: iso(3), registrationDeadline: iso(1), requirements: [{ id: 'r5', stepOrder: 1, kind: 'register', required: true, dueAt: iso(1) }] },
  ]
  const userEvents = [
    { eventId: 'skip', status: 'skipped' },
    { eventId: 'past', status: 'attended', followupDueAt: iso(-2), followupDoneAt: null },
    { eventId: 'fair', status: 'registering', followupDueAt: iso(5), followupDoneAt: null },
  ]
  it('eventRequirementsDue: overdue first, skips past/skipped events and completed steps', () => {
    const due = eventRequirementsDue(events, [{ requirementId: 'r1', completedAt: iso(-1) }], { now, userEvents })
    expect(due.map(d => `${d.event.id}:${d.requirement.id}`)).toEqual(['fair:r2'])
    expect(due[0].overdue).toBe(true)
    expect(eventRequirementsDue(events, [], { now, userEvents }).map(d => d.requirement.id)).toEqual(['r2', 'r1'])
  })
  it('registrationClosingSoon honours skipped/confirmed and the horizon', () => {
    expect(registrationClosingSoon(events, userEvents, { now }).map(x => x.event.id)).toEqual(['fair'])
    expect(registrationClosingSoon(events, [{ eventId: 'fair', status: 'confirmed' }], { now }).map(x => x.event.id)).toEqual(['skip'])
    expect(registrationClosingSoon(events, [], { now, withinDays: 2 }).map(x => x.event.id)).toEqual(['skip'])
  })
  it('eventFollowUpsOverdue returns only due, unclosed follow-ups', () => {
    const f = eventFollowUpsOverdue(userEvents, events, { now })
    expect(f.map(x => x.event.id)).toEqual(['past'])
    expect(f[0].daysOverdue).toBe(2)
  })
  it('degradedEventSources', () => {
    expect(degradedEventSources([{ id: 1, degradedAt: null }, { id: 2, degradedAt: iso(-1) }, { id: 3, degradedAt: iso(0) }]).map(s => s.id)).toEqual([3, 2])
  })
})
