import { describe, it, expect } from 'vitest'
import { parseDay, daysSince, daysUntil, daysBetween, formatDay, localDateStr, addDaysLocal } from '../src/lib/dates.js'

// All expectations are built from local constructors, so they hold in any TZ
// (run with TZ=America/New_York and TZ=UTC).
describe('parseDay', () => {
  it('parses date-only strings as local midnight', () => {
    const d = parseDay('2026-10-06')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 6, 0])
  })
  it('leaves timestamps, Dates and numbers as real instants', () => {
    expect(parseDay('2026-10-06T03:00:00Z').getTime()).toBe(Date.UTC(2026, 9, 6, 3))
    expect(parseDay('2026-10-06T10:00:00-04:00').getTime()).toBe(Date.UTC(2026, 9, 6, 14))
    const x = new Date(12345)
    expect(parseDay(x).getTime()).toBe(12345)
    expect(parseDay(99).getTime()).toBe(99)
  })
})

describe('day math', () => {
  const noon = new Date(2026, 9, 9, 12, 0)
  const late = new Date(2026, 9, 9, 23, 30)
  it('counts calendar days from today local midnight', () => {
    for (const now of [noon, late, new Date(2026, 9, 9, 0, 5)]) {
      expect(daysUntil('2026-10-09', now)).toBe(0)
      expect(daysUntil('2026-10-10', now)).toBe(1)
      expect(daysUntil('2026-10-08', now)).toBe(-1)
      expect(daysSince('2026-10-08', now)).toBe(1)
      expect(daysSince('2026-10-09', now)).toBe(0)
    }
  })
  it('handles timestamps and null', () => {
    expect(daysSince(new Date(2026, 9, 7, 22, 0).toISOString(), noon)).toBe(2)
    expect(daysUntil(null)).toBeNull()
    expect(daysSince('')).toBeNull()
    expect(daysBetween('2026-10-01', null)).toBeNull()
  })
  it('daysBetween spans DST changes in whole days', () => {
    expect(daysBetween('2026-10-01', '2026-10-06')).toBe(5)
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('formatting and local today', () => {
  it('fmt shows the stored day, not the previous one', () => {
    expect(formatDay('2026-10-06')).toBe('Oct 6')
    expect(formatDay('')).toBe('—')
  })
  it('localDateStr uses local fields', () => {
    expect(localDateStr(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDateStr(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
    expect(addDaysLocal(7, new Date(2026, 11, 28, 22, 0))).toBe('2027-01-04')
  })
})
