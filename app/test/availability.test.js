import { describe, it, expect } from 'vitest'
import { suggestSlots, normalizeAvailability, formatSlot, defaultAvailability } from '../src/lib/availability.js'

const NY = 'America/New_York'
const weekdays = { days: [1, 2, 3, 4, 5], start: 9, end: 18, slotMin: 30, timeZone: NY }
// Monday 2026-10-19, 08:00 EDT (12:00Z)
const MON_8AM = Date.parse('2026-10-19T12:00:00Z')

const localDay = iso => new Intl.DateTimeFormat('en-US', { timeZone: NY, weekday: 'short' }).format(new Date(iso))
const localHour = iso => Number(new Intl.DateTimeFormat('en-US', { timeZone: NY, hour: 'numeric', hourCycle: 'h23' }).format(new Date(iso)))

describe('normalizeAvailability', () => {
  it('rejects unset or impossible windows', () => {
    expect(normalizeAvailability(null)).toBeNull()
    expect(normalizeAvailability({ ...weekdays, days: [] })).toBeNull()
    expect(normalizeAvailability({ ...weekdays, start: 18, end: 9 })).toBeNull()
    expect(normalizeAvailability({ ...weekdays, start: 9, end: 9, slotMin: 30 })).toBeNull()
  })

  it('cleans up days, slot length and a bad zone', () => {
    expect(normalizeAvailability({ days: [5, '1', 9, 1], start: 9, end: 17, slotMin: 7, timeZone: 'Nowhere/City' }))
      .toEqual({ days: [1, 5], start: 9, end: 17, slotMin: 30, timeZone: NY })
  })

  it('defaults to weekdays 9–6, 30 minutes', () => {
    expect(defaultAvailability(NY)).toEqual(weekdays)
  })
})

describe('suggestSlots', () => {
  it('returns nothing without availability', () => {
    expect(suggestSlots({ availability: null, now: MON_8AM })).toEqual([])
  })

  it('offers 3 slots on different days, at least 18h out, inside the window', () => {
    const slots = suggestSlots({ availability: weekdays, now: MON_8AM })
    expect(slots).toHaveLength(3)
    expect(new Set(slots.map(s => localDay(s.start))).size).toBe(3)
    for (const s of slots) {
      expect(Date.parse(s.start)).toBeGreaterThanOrEqual(MON_8AM + 18 * 3600000)
      expect(localHour(s.start)).toBeGreaterThanOrEqual(9)
      expect(Date.parse(s.end) - Date.parse(s.start)).toBe(30 * 60000)
      expect(localHour(s.end) * 60).toBeLessThanOrEqual(18 * 60)
    }
    expect(localDay(slots[0].start)).toBe('Tue') // Monday is inside the lead time
  })

  it('skips weekends', () => {
    const fri = Date.parse('2026-10-23T12:00:00Z')
    const slots = suggestSlots({ availability: weekdays, now: fri })
    expect(slots.map(s => localDay(s.start))).not.toContain('Sat')
    expect(slots.map(s => localDay(s.start))).not.toContain('Sun')
  })

  it('never overlaps a busy block', () => {
    // Tuesday and Wednesday fully booked, Thursday morning busy
    const busy = [
      { start: '2026-10-20T13:00:00Z', end: '2026-10-20T22:00:00Z' },
      { start: '2026-10-21T13:00:00Z', end: '2026-10-21T22:00:00Z' },
      { start: '2026-10-22T13:00:00Z', end: '2026-10-22T17:00:00Z' },
    ]
    const slots = suggestSlots({ availability: weekdays, now: MON_8AM, busy })
    expect(slots.length).toBeGreaterThan(0)
    for (const s of slots) {
      const [a, b] = [Date.parse(s.start), Date.parse(s.end)]
      expect(busy.some(x => Date.parse(x.start) < b && Date.parse(x.end) > a)).toBe(false)
    }
    expect(slots.map(s => localDay(s.start))).not.toContain('Tue')
  })

  it('uses wall-clock hours across the DST change', () => {
    // Fri 2026-10-30; US clocks fall back Sun Nov 1, so Monday is EST
    const slots = suggestSlots({ availability: { ...weekdays, start: 9, end: 10 }, now: Date.parse('2026-10-30T12:00:00Z'), count: 2 })
    for (const s of slots) expect(localHour(s.start)).toBe(9)
    expect(slots.find(s => localDay(s.start) === 'Mon').start).toBe('2026-11-02T14:00:00.000Z')
  })

  it('works in a zone other than the server\'s', () => {
    const slots = suggestSlots({ availability: { ...weekdays, timeZone: 'Asia/Tokyo' }, now: MON_8AM })
    for (const s of slots) {
      const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', hourCycle: 'h23' }).format(new Date(s.start)))
      expect(h).toBeGreaterThanOrEqual(9)
      expect(h).toBeLessThan(18)
    }
  })

  it('doubles up on a day when only one day is free', () => {
    const slots = suggestSlots({ availability: { ...weekdays, days: [3] }, now: MON_8AM, workingDays: 1 })
    expect(slots).toHaveLength(3)
    expect(new Set(slots.map(s => localDay(s.start)))).toEqual(new Set(['Wed']))
  })
})

describe('formatSlot', () => {
  it('formats in the given zone', () => {
    expect(formatSlot({ start: '2026-10-20T18:00:00Z', end: '2026-10-20T18:30:00Z' }, NY)).toBe('Tue, Oct 20, 2:00 PM – 2:30 PM EDT')
  })
})
