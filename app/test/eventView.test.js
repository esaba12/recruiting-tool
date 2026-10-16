import { describe, it, expect } from 'vitest'
import {
  EVENT_FILTERS, eventFacts, matchesFilter, filterCounts, kindsPresent, matchesSearch,
  employerNamesFor, formatEmployerList, dayKeyInZone, dayLabel, groupByDay, countdownLabel,
  dueLabel, nextStepInfo, registrationCountdown, staleInfo, timeRangeLabel, eventEndMs, kindLabel, dateTimeLabel,
} from '../src/lib/eventView.js'

const DAY = 86400000
const HOUR = 3600000
const now = Date.UTC(2026, 9, 16, 16)          // Fri Oct 16 2026, 12:00 EDT
const iso = ms => new Date(ms).toISOString()

const ev = (over = {}) => ({
  id: 'e1', kind: 'career_fair', title: 'Fall Fair', location: 'Duderstadt', timezone: 'America/Detroit',
  startsAt: iso(now + 2 * DAY), endsAt: iso(now + 2 * DAY + 6 * HOUR), requirements: [], attributes: null,
  employerId: null, visibility: 'shared', sourceLastVerifiedAt: iso(now - DAY), ...over,
})

describe('eventFacts + filter predicates', () => {
  const facts = (e, { tier = 'high', status = null } = {}) => eventFacts(e, { tier, status, now })

  it('exposes the five chips in order', () => {
    expect(EVENT_FILTERS.map(f => f.key)).toEqual(['forYou', 'upcoming', 'going', 'past', 'dismissed'])
  })

  it('For you = high/medium, upcoming, not dismissed', () => {
    expect(matchesFilter('forYou', facts(ev()))).toBe(true)
    expect(matchesFilter('forYou', facts(ev(), { tier: 'medium' }))).toBe(true)
    expect(matchesFilter('forYou', facts(ev(), { tier: 'low' }))).toBe(false)
    expect(matchesFilter('forYou', facts(ev(), { tier: 'dismissed' }))).toBe(false)
    expect(matchesFilter('forYou', facts(ev(), { tier: null }))).toBe(false)
    expect(matchesFilter('forYou', facts(ev({ startsAt: iso(now - 2 * DAY), endsAt: iso(now - 2 * DAY + HOUR) })))).toBe(false)
  })

  it('All upcoming excludes past and dismissed', () => {
    expect(matchesFilter('upcoming', facts(ev(), { tier: 'low' }))).toBe(true)
    expect(matchesFilter('upcoming', facts(ev(), { tier: 'dismissed' }))).toBe(false)
  })

  it('an event in progress (started, not ended) is still upcoming, not past', () => {
    const f = facts(ev({ startsAt: iso(now - HOUR), endsAt: iso(now + HOUR) }))
    expect(f.past).toBe(false)
    expect(matchesFilter('upcoming', f)).toBe(true)
    expect(matchesFilter('past', f)).toBe(false)
  })

  it('an event with no end is past one hour after it starts', () => {
    expect(facts(ev({ startsAt: iso(now - 30 * 60000), endsAt: null })).past).toBe(false)
    expect(facts(ev({ startsAt: iso(now - 2 * HOUR), endsAt: null })).past).toBe(true)
    expect(eventEndMs(ev({ startsAt: iso(now), endsAt: null }))).toBe(now + HOUR)
  })

  it('Registering/Going = registering|confirmed upcoming events, even if dismissed', () => {
    expect(matchesFilter('going', facts(ev(), { status: 'registering' }))).toBe(true)
    expect(matchesFilter('going', facts(ev(), { status: 'confirmed', tier: 'dismissed' }))).toBe(true)
    expect(matchesFilter('going', facts(ev(), { status: 'interested' }))).toBe(false)
    expect(matchesFilter('going', facts(ev({ startsAt: iso(now - 3 * DAY), endsAt: iso(now - 3 * DAY) }), { status: 'confirmed' }))).toBe(false)
  })

  it('Past excludes dismissed; Dismissed includes past and upcoming dismissed', () => {
    const pastEv = ev({ startsAt: iso(now - 3 * DAY), endsAt: iso(now - 3 * DAY + HOUR) })
    expect(matchesFilter('past', facts(pastEv))).toBe(true)
    expect(matchesFilter('past', facts(pastEv, { tier: 'dismissed' }))).toBe(false)
    expect(matchesFilter('dismissed', facts(pastEv, { tier: 'dismissed' }))).toBe(true)
    expect(matchesFilter('dismissed', facts(ev(), { tier: 'dismissed' }))).toBe(true)
    expect(matchesFilter('dismissed', facts(ev()))).toBe(false)
  })

  it('filterCounts counts each chip independently', () => {
    const list = [
      facts(ev({ id: 'a' })),
      facts(ev({ id: 'b' }), { tier: 'low' }),
      facts(ev({ id: 'c' }), { tier: 'dismissed' }),
      facts(ev({ id: 'd', startsAt: iso(now - 3 * DAY), endsAt: iso(now - 3 * DAY) })),
      facts(ev({ id: 'e' }), { status: 'registering', tier: 'medium' }),
    ]
    expect(filterCounts(list)).toEqual({ forYou: 2, upcoming: 3, going: 1, past: 1, dismissed: 1 })
  })
})

describe('kinds + search', () => {
  it('lists kinds present, known kinds first in a fixed order', () => {
    expect(kindsPresent([ev({ kind: 'workshop' }), ev({ kind: 'info_session' }), ev({ kind: 'career_fair' }), ev({ kind: 'info_session' })]))
      .toEqual(['career_fair', 'info_session', 'workshop'])
    expect(kindLabel('coffee_chat')).toBe('Coffee chat')
    expect(kindLabel('mystery_kind')).toBe('Mystery kind')
  })

  it('searches title, employer names and location, case-insensitively', () => {
    const e = ev({ title: 'Info Session', location: 'BBB 1670' })
    expect(matchesSearch(e, '', [])).toBe(true)
    expect(matchesSearch(e, 'info', [])).toBe(true)
    expect(matchesSearch(e, 'stripe', ['Stripe'])).toBe(true)
    expect(matchesSearch(e, 'bbb', [])).toBe(true)
    expect(matchesSearch(e, 'figma', ['Stripe'])).toBe(false)
  })
})

describe('employer resolution', () => {
  const employersById = new Map([['x', { id: 'x', name: 'Stripe' }], ['y', { id: 'y', name: 'Anthropic' }], ['z', { id: 'z', name: 'Ramp' }]])

  it('merges employerId + attribute employerIds, deduped, host first', () => {
    expect(employerNamesFor(ev({ employerId: 'y', attributes: { employerIds: ['x', 'y', 'z', 'missing'] } }), employersById))
      .toEqual(['Anthropic', 'Stripe', 'Ramp'])
  })

  it('falls back to the extracted employer text when no ids resolve', () => {
    expect(employerNamesFor(ev({ attributes: { employer: 'Jane Street', employerIds: [] } }), employersById)).toEqual(['Jane Street'])
    expect(employerNamesFor(ev(), employersById)).toEqual([])
  })

  it('formats with a "+N" overflow', () => {
    expect(formatEmployerList(['Stripe', 'Anthropic', 'Ramp'], 2)).toBe('Stripe, Anthropic +1')
    expect(formatEmployerList(['Stripe'], 2)).toBe('Stripe')
    expect(formatEmployerList([], 2)).toBe('')
  })
})

describe('day grouping', () => {
  it('buckets by the event’s own timezone, not UTC', () => {
    // 03:30Z on Oct 23 is 23:30 on Oct 22 in Detroit.
    expect(dayKeyInZone('2026-10-23T03:30:00Z', 'America/Detroit')).toBe('2026-10-22')
    expect(dayKeyInZone('2026-10-23T03:30:00Z', 'UTC')).toBe('2026-10-23')
  })

  it('labels a day key like "Thu Oct 22"', () => {
    expect(dayLabel('2026-10-22')).toBe('Thu Oct 22')
  })

  it('groups chronologically with a countdown, events sorted within a day', () => {
    const a = ev({ id: 'a', startsAt: '2026-10-23T03:30:00Z' })          // Oct 22 late (Detroit)
    const b = ev({ id: 'b', startsAt: '2026-10-22T14:00:00Z' })          // Oct 22 morning
    const c = ev({ id: 'c', startsAt: '2026-10-16T20:00:00Z' })          // today
    const groups = groupByDay([a, c, b], { now })
    expect(groups.map(g => g.key)).toEqual(['2026-10-16', '2026-10-22'])
    expect(groups[1].events.map(e => e.id)).toEqual(['b', 'a'])
    expect(groups[0].daysUntil).toBe(0)
    expect(groups[1].daysUntil).toBe(6)
    expect(groups[1].label).toBe('Thu Oct 22')
  })

  it('can order newest-first for the Past chip', () => {
    const groups = groupByDay([ev({ id: 'a', startsAt: '2026-10-10T14:00:00Z' }), ev({ id: 'b', startsAt: '2026-10-12T14:00:00Z' })], { now, order: 'desc' })
    expect(groups.map(g => g.key)).toEqual(['2026-10-12', '2026-10-10'])
    expect(groups[0].daysUntil).toBe(-4)
  })

  it('uses the fallback zone when the event has none', () => {
    const groups = groupByDay([ev({ timezone: null, startsAt: '2026-10-23T03:30:00Z' })], { now, fallbackTz: 'America/Detroit' })
    expect(groups[0].key).toBe('2026-10-22')
  })

  it('countdown labels', () => {
    expect(countdownLabel(0)).toBe('today')
    expect(countdownLabel(1)).toBe('tomorrow')
    expect(countdownLabel(6)).toBe('in 6d')
    expect(countdownLabel(-4)).toBe('4d ago')
  })
})

describe('time range', () => {
  it('renders 24h wall-clock in the event zone', () => {
    expect(timeRangeLabel(ev({ startsAt: '2026-10-22T14:00:00Z', endsAt: '2026-10-22T20:00:00Z' }))).toBe('10:00–16:00')
    expect(timeRangeLabel(ev({ startsAt: '2026-10-22T14:00:00Z', endsAt: null }))).toBe('10:00')
    expect(timeRangeLabel(ev({ allDay: true }))).toBe('All day')
  })

  it('dateTimeLabel renders day + 24h time in a zone', () => {
    expect(dateTimeLabel('2026-10-23T03:59:00Z', 'America/Detroit')).toBe('Thu Oct 22 · 23:59')
    expect(dateTimeLabel(null, 'UTC')).toBe('')
  })
})

describe('due + next step labels', () => {
  it('dueLabel covers hours, days and overdue', () => {
    expect(dueLabel(iso(now + 2 * DAY + HOUR), now)).toEqual({ label: 'due in 2d', overdue: false, soon: true })
    expect(dueLabel(iso(now + 5 * HOUR), now)).toEqual({ label: 'due in 5h', overdue: false, soon: true })
    expect(dueLabel(iso(now + 10 * DAY), now)).toEqual({ label: 'due in 10d', overdue: false, soon: false })
    expect(dueLabel(iso(now - 2 * HOUR), now)).toEqual({ label: 'overdue', overdue: true, soon: false })
    expect(dueLabel(iso(now - 3 * DAY), now)).toEqual({ label: '3d overdue', overdue: true, soon: false })
    expect(dueLabel(iso(now + 20 * HOUR), now, 'America/Detroit').label).toBe('due tomorrow')
    expect(dueLabel('2026-10-15T04:00:00Z', Date.UTC(2026, 9, 16, 5), 'America/Detroit').label).toBe('1d overdue') // Thu 00:00 vs Fri 01:00 local
    expect(dueLabel(null, now)).toBe(null)
  })

  const reqs = [
    { id: 'r1', stepOrder: 1, kind: 'register', label: 'Register on CFP', required: true, dueAt: iso(now - DAY) },
    { id: 'r2', stepOrder: 2, kind: 'upload_resume', label: '', required: true, dueAt: iso(now + 2 * DAY + HOUR) },
    { id: 'r3', stepOrder: 3, kind: 'rsvp_external', label: 'RSVP mixer', required: false, dueAt: null },
  ]

  it('names the first incomplete REQUIRED step, overdue when past due', () => {
    expect(nextStepInfo(ev({ requirements: reqs }), [], now)).toMatchObject({ text: 'Next: Register on CFP · 1d overdue', overdue: true })
  })

  it('falls back to the kind label and skips optional steps', () => {
    const done = [{ requirementId: 'r1', completedAt: iso(now) }]
    expect(nextStepInfo(ev({ requirements: reqs }), done, now)).toMatchObject({ text: 'Next: Upload résumé · due in 2d', overdue: false })
    const allReq = [...done, { requirementId: 'r2', completedAt: iso(now) }]
    expect(nextStepInfo(ev({ requirements: reqs }), allReq, now)).toBe(null)
  })

  it('omits the due part when the step has no due date', () => {
    expect(nextStepInfo(ev({ requirements: [{ id: 'q', stepOrder: 1, kind: 'invite_only_selection', label: 'Wait for invite', required: true, dueAt: null }] }), [], now).text)
      .toBe('Next: Wait for invite')
  })
})

describe('registration countdown + stale', () => {
  it('only shows inside 7 days and before the deadline', () => {
    expect(registrationCountdown(ev({ registrationDeadline: iso(now + 3 * DAY + HOUR) }), now)).toEqual({ label: 'Reg. closes in 3d', urgent: false })
    expect(registrationCountdown(ev({ registrationDeadline: iso(now + 20 * HOUR) }), now)).toEqual({ label: 'Reg. closes tomorrow', urgent: true })
    expect(registrationCountdown(ev({ registrationDeadline: iso(now + 6 * HOUR) }), now)).toEqual({ label: 'Reg. closes in 6h', urgent: true })
    // Counted in calendar days in the event's zone, like Today: Fri 17:40 → Sun 12:00 is 2 days, not 1.
    const friEvening = Date.UTC(2026, 9, 16, 21, 40)
    expect(registrationCountdown(ev({ registrationDeadline: '2026-10-18T16:00:00Z' }), friEvening).label).toBe('Reg. closes in 2d')
    expect(registrationCountdown(ev({ registrationDeadline: iso(now + 9 * DAY) }), now)).toBe(null)
    expect(registrationCountdown(ev({ registrationDeadline: iso(now - HOUR) }), now)).toBe(null)
    expect(registrationCountdown(ev(), now)).toBe(null)
  })

  it('stale after 14 days, with days since verification', () => {
    expect(staleInfo(ev({ sourceLastVerifiedAt: iso(now - 21 * DAY) }), now)).toEqual({ days: 21, label: 'stale · last verified 21d ago' })
    expect(staleInfo(ev({ sourceLastVerifiedAt: iso(now - 3 * DAY) }), now)).toBe(null)
    expect(staleInfo(ev({ sourceLastVerifiedAt: null }), now)).toEqual({ days: null, label: 'stale · never verified' })
  })
})
