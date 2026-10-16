import { describe, it, expect } from 'vitest'
import { countdownLabel, followUpLabel, dedupeRegistrations, deriveEventAttention } from '../src/components/today/EventAttentionSections.jsx'

const TZ = 'America/Detroit'
// Thu 2026-10-15 12:00 Detroit (EDT, UTC-4)
const now = Date.parse('2026-10-15T16:00:00Z')
const at = iso => Date.parse(iso)

describe('countdownLabel', () => {
  it('counts calendar days in the event timezone', () => {
    expect(countdownLabel(at('2026-10-15T22:00:00Z'), now, { timeZone: TZ })).toBe('due today')
    // 11:59 PM Detroit tomorrow = 03:59Z the day after
    expect(countdownLabel(at('2026-10-17T03:59:00Z'), now, { timeZone: TZ })).toBe('due tomorrow')
    expect(countdownLabel(at('2026-10-17T14:00:00Z'), now, { timeZone: TZ })).toBe('due in 2d')
  })
  it('labels overdue and closed', () => {
    expect(countdownLabel(at('2026-10-15T13:00:00Z'), now, { timeZone: TZ })).toBe('was due today')
    expect(countdownLabel(at('2026-10-14T21:00:00Z'), now, { timeZone: TZ })).toBe('overdue 1d')
    expect(countdownLabel(at('2026-10-16T14:00:00Z'), now, { timeZone: TZ, verb: 'closes' })).toBe('closes tomorrow')
    expect(countdownLabel(at('2026-10-12T14:00:00Z'), now, { timeZone: TZ, verb: 'closes' })).toBe('closed 3d ago')
  })
  it('survives a bogus timezone', () => {
    expect(() => countdownLabel(at('2026-10-20T14:00:00Z'), now, { timeZone: 'Not/AZone' })).not.toThrow()
  })
})

describe('followUpLabel', () => {
  it('formats whole days', () => {
    expect(followUpLabel(0)).toBe('due today')
    expect(followUpLabel(2)).toBe('overdue 2d')
  })
})

describe('dedupeRegistrations', () => {
  it('drops a registration already shown as a register step', () => {
    const regs = [{ event: { id: 'a' } }, { event: { id: 'b' } }]
    const steps = [{ event: { id: 'a' }, requirement: { kind: 'register' } }, { event: { id: 'b' }, requirement: { kind: 'upload_resume' } }]
    expect(dedupeRegistrations(regs, steps).map(r => r.event.id)).toEqual(['b'])
  })
})

describe('deriveEventAttention', () => {
  const ev = (id, extra = {}) => ({ id, title: id, startsAt: '2026-10-20T14:00:00Z', timezone: TZ, requirements: [], ...extra })
  const pool = {
    school: { id: 's' },
    events: [
      ev('reg', { registrationDeadline: '2026-10-17T03:59:00Z' }),
      ev('dup', { registrationDeadline: '2026-10-17T03:59:00Z', requirements: [{ id: 'r1', kind: 'register', dueAt: '2026-10-17T03:59:00Z', required: true }] }),
      ev('gone', { registrationDeadline: '2026-10-17T03:59:00Z' }),
      ev('past', { startsAt: '2026-10-10T14:00:00Z' }),
    ],
    userEvents: [{ eventId: 'past', status: 'attended', followupDueAt: '2026-10-13T12:00:00Z', followupDoneAt: null }],
    completions: [],
    sources: [{ id: 'x', degradedAt: '2026-10-14T00:00:00Z' }, { id: 'y', degradedAt: null }],
    tierOf: e => (e.id === 'gone' ? 'dismissed' : 'high'),
  }
  it('returns nothing without a campus', () => {
    expect(deriveEventAttention(null).count).toBe(0)
    expect(deriveEventAttention({ ...pool, school: null }, now)).toMatchObject({ count: 0, degraded: [] })
  })
  it('filters dismissed, dedupes, and counts only actionable items', () => {
    const a = deriveEventAttention(pool, now)
    expect(a.steps.map(s => s.event.id)).toEqual(['dup'])
    expect(a.registrations.map(r => r.event.id)).toEqual(['reg'])
    expect(a.followUps.map(f => f.event.id)).toEqual(['past'])
    expect(a.degraded.map(s => s.id)).toEqual(['x'])
    expect(a.count).toBe(3)
  })
})
