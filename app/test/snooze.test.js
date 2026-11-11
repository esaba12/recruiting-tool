import { describe, it, expect } from 'vitest'
import { snoozeOptions, snoozeActive, snoozeEntry, dueOf, backLabel } from '../src/lib/snooze.js'

// v1.5 spec 04.
const at = (y, m, d, h = 9) => new Date(y, m - 1, d, h, 0).getTime()
const WED = at(2026, 11, 11) // Wednesday
const SUN = at(2026, 11, 15)
const ids = opts => opts.map(o => o.id)

describe('snoozeOptions', () => {
  it('offers Tomorrow and Monday at 8:00 local, and Next week', () => {
    const o = snoozeOptions({}, { now: WED })
    expect(ids(o)).toEqual(['tomorrow', 'monday', 'week'])
    expect(new Date(o[0].until)).toEqual(new Date(2026, 10, 12, 8))
    expect(new Date(o[1].until)).toEqual(new Date(2026, 10, 16, 8))
    expect(o[2].until).toBe(WED + 7 * 86400000)
  })

  it('drops Monday on a Sunday, where it would equal Tomorrow', () => {
    expect(ids(snoozeOptions({}, { now: SUN }))).toEqual(['tomorrow', 'week'])
  })

  it('on a Monday, "Monday" means next Monday', () => {
    const MON = at(2026, 11, 16)
    expect(new Date(snoozeOptions({}, { now: MON })[1].until)).toEqual(new Date(2026, 10, 23, 8))
  })

  it('offers After the interview for a future interview, the morning after', () => {
    const o = snoozeOptions({ row: { interviewAt: new Date(2026, 10, 13, 14).toISOString() } }, { now: WED })
    expect(o.at(-1)).toMatchObject({ id: 'interview', label: 'After the interview' })
    expect(new Date(o.at(-1).until)).toEqual(new Date(2026, 10, 14, 8))
  })

  it('offers After the deadline for a future due date, not for a past one', () => {
    expect(ids(snoozeOptions({ due: at(2026, 11, 20, 0) }, { now: WED }))).toContain('deadline')
    expect(ids(snoozeOptions({ due: at(2026, 11, 10, 0) }, { now: WED }))).not.toContain('deadline')
    expect(ids(snoozeOptions({ row: { interviewAt: new Date(2026, 10, 10).toISOString() } }, { now: WED }))).not.toContain('interview')
  })

  it('keeps 8:00 across the DST change', () => {
    const SAT = at(2026, 10, 31) // the night before US DST ends
    expect(new Date(snoozeOptions({}, { now: SAT })[0].until).getHours()).toBe(8)
  })
})

describe('snoozeActive', () => {
  it('reads legacy numbers and new entries', () => {
    expect(snoozeEntry(123)).toEqual({ until: 123, due: null })
    expect(snoozeActive(WED + 1000, { now: WED })).toBe(true)
    expect(snoozeActive(WED - 1000, { now: WED })).toBe(false)
    expect(snoozeActive(undefined, { now: WED })).toBe(false)
  })

  it("ends early when the item's date moved", () => {
    const stored = { until: WED + 86400000, due: '2026-11-15' }
    expect(snoozeActive(stored, { now: WED, due: '2026-11-15' })).toBe(true)
    expect(snoozeActive(stored, { now: WED, due: '2026-11-18' })).toBe(false)
    expect(snoozeActive({ until: WED + 86400000, due: null }, { now: WED, due: '2026-11-18' })).toBe(true)
  })

  it('dueOf picks the date per list', () => {
    expect(dueOf('oa', { oaDueDate: '2026-11-15' })).toBe('2026-11-15')
    expect(dueOf('interview', { interviewAt: 'x' })).toBe('x')
    expect(dueOf('awaiting', { contact: {} })).toBeNull()
  })
})

describe('backLabel', () => {
  it('reads tomorrow, a weekday, or a date', () => {
    expect(backLabel(at(2026, 11, 12, 8), WED)).toBe('back tomorrow')
    expect(backLabel(at(2026, 11, 16, 8), WED)).toBe('back Mon')
    expect(backLabel(at(2026, 11, 25, 8), WED)).toBe('back Nov 25')
  })
})
