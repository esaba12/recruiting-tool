import { describe, it, expect } from 'vitest'
import { freeFragments, formatFragments, classifyBlocks, conflictsForEvent } from '../src/lib/conflicts.js'

// All wall-clock times below are America/Detroit (EDT, UTC−4) on 2026-09-14.
const TZ = 'America/Detroit'
const t = (hh, mm = 0, day = 14) => `2026-09-${String(day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00-04:00`
const window = { start: t(10), end: t(16) }          // the fair, 10:00–16:00
const clock = f => formatFragments(f, TZ)

describe('freeFragments — the canonical case from the brief', () => {
  it('10:00–16:00 fair vs 12:00–13:30 + 16:00–17:30 class, 15-min transit → 10:00–11:45 and 13:45–15:45', () => {
    const blocks = [
      { id: 'c1', title: 'EECS 281', start: t(12), end: t(13, 30) },
      { id: 'c2', title: 'MATH 215', start: t(16), end: t(17, 30) },
    ]
    const r = freeFragments({ window, blocks, transitBufferMin: 15, timeZone: TZ })
    expect(clock(r.fragments)).toBe('10:00–11:45, 13:45–15:45')
    expect(r.fragments.map(f => f.minutes)).toEqual([105, 120])
    expect(r.totalFreeMinutes).toBe(225)
    expect(r.hardBlocks.map(b => b.id)).toEqual(['c1', 'c2'])
  })
  it('with no transit buffer the fragments touch the blocks', () => {
    const blocks = [{ id: 'c1', start: t(12), end: t(13, 30) }]
    expect(clock(freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ }).fragments)).toBe('10:00–12:00, 13:30–16:00')
  })
})

describe('edge cases', () => {
  it('no blocks → the whole window is one fragment', () => {
    const r = freeFragments({ window, blocks: [], timeZone: TZ })
    expect(clock(r.fragments)).toBe('10:00–16:00')
  })
  it('a block covering the whole window → no fragments', () => {
    const r = freeFragments({ window, blocks: [{ id: 'x', start: t(9), end: t(17) }], timeZone: TZ })
    expect(r.fragments).toEqual([])
    expect(r.totalFreeMinutes).toBe(0)
  })
  it('blocks straddling the window boundary are clipped', () => {
    const blocks = [{ id: 'a', start: t(9, 30), end: t(10, 30) }, { id: 'b', start: t(15, 30), end: t(17) }]
    expect(clock(freeFragments({ window, blocks, transitBufferMin: 15, timeZone: TZ }).fragments)).toBe('10:45–15:15')
  })
  it('overlapping and back-to-back hard blocks merge into one gap', () => {
    const blocks = [
      { id: 'a', start: t(12), end: t(13) }, { id: 'b', start: t(12, 30), end: t(13, 30) }, { id: 'c', start: t(13, 30), end: t(14) },
    ]
    expect(clock(freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ }).fragments)).toBe('10:00–12:00, 14:00–16:00')
  })
  it('fragments shorter than minFragmentMin are dropped', () => {
    const blocks = [{ id: 'a', start: t(10, 20), end: t(15, 40) }]
    const r = freeFragments({ window, blocks, transitBufferMin: 15, minFragmentMin: 20, timeZone: TZ })
    expect(r.fragments).toEqual([])
    expect(freeFragments({ window, blocks, transitBufferMin: 0, minFragmentMin: 20, timeZone: TZ }).fragments.length).toBe(2)
  })
  it('blocks outside the window are ignored entirely', () => {
    const blocks = [{ id: 'a', start: t(7), end: t(8) }, { id: 'b', start: t(18), end: t(19) }]
    expect(clock(freeFragments({ window, blocks, timeZone: TZ }).fragments)).toBe('10:00–16:00')
  })
})

describe('hard vs soft', () => {
  const blocks = [
    { id: 'lec', title: 'EECS 485 (recorded)', start: t(11), end: t(12) },
    { id: 'lab', title: 'EECS 281 lab', start: t(14), end: t(15) },
  ]
  it('every timed block is hard by default', () => {
    expect(clock(freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ }).fragments)).toBe('10:00–11:00, 12:00–14:00, 15:00–16:00')
  })
  it('a per-block override to soft frees its time but still reports the overlap', () => {
    const r = freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ, overrides: { lec: 'soft' } })
    expect(clock(r.fragments)).toBe('10:00–14:00, 15:00–16:00')
    expect(r.softBlocks.map(b => b.id)).toEqual(['lec'])
    expect(r.softOverlaps).toEqual([{ id: 'lec', title: 'EECS 485 (recorded)', overlapMinutes: 60, start: blocks[0].start, end: blocks[0].end }])
  })
  it('all-day blocks are soft by default (informational) and can be forced hard', () => {
    const allDay = [{ id: 'hw', title: 'Homecoming Week', start: '2026-09-14', end: '2026-09-15', allDay: true }]
    const soft = freeFragments({ window, blocks: allDay, timeZone: TZ })
    expect(clock(soft.fragments)).toBe('10:00–16:00')
    expect(soft.softOverlaps[0]).toMatchObject({ id: 'hw', overlapMinutes: 360 })
    const hard = freeFragments({ window, blocks: allDay, timeZone: TZ, overrides: { hw: 'hard' } })
    expect(hard.fragments).toEqual([])
  })
  it('an explicit block.soft flag is honoured unless overridden', () => {
    const b = [{ id: 'async', start: t(11), end: t(12), soft: true }]
    expect(clock(freeFragments({ window, blocks: b, transitBufferMin: 0, timeZone: TZ }).fragments)).toBe('10:00–16:00')
    expect(clock(freeFragments({ window, blocks: b, transitBufferMin: 0, timeZone: TZ, overrides: { async: 'hard' } }).fragments)).toBe('10:00–11:00, 12:00–16:00')
  })
  it('classifyBlocks exposes the effective hard/soft decision per block', () => {
    const c = classifyBlocks([...blocks, { id: 'hw', start: '2026-09-14', end: '2026-09-15', allDay: true }], { overrides: { lab: 'soft' } })
    expect(c.map(b => [b.id, b.effective])).toEqual([['lec', 'hard'], ['lab', 'soft'], ['hw', 'soft']])
  })
})

describe('time zones + all-day interpretation', () => {
  it('blocks expressed in another offset still subtract correctly', () => {
    // 09:00–10:30 Pacific == 12:00–13:30 Detroit
    const blocks = [{ id: 'pt', start: '2026-09-14T09:00:00-07:00', end: '2026-09-14T10:30:00-07:00' }]
    expect(clock(freeFragments({ window, blocks, transitBufferMin: 15, timeZone: TZ }).fragments)).toBe('10:00–11:45, 13:45–16:00')
  })
  it('Zulu window + local-offset blocks', () => {
    const w = { start: '2026-09-14T14:00:00Z', end: '2026-09-14T20:00:00Z' }   // 10:00–16:00 Detroit
    const blocks = [{ id: 'c1', start: t(12), end: t(13, 30) }]
    expect(clock(freeFragments({ window: w, blocks, transitBufferMin: 0, timeZone: TZ }).fragments)).toBe('10:00–12:00, 13:30–16:00')
  })
  it('an all-day block is interpreted in the given zone (Google end date is exclusive)', () => {
    const w = { start: t(22, 0, 14), end: t(2, 0, 15) }     // 22:00 → 02:00 next day, Detroit
    const blocks = [{ id: 'd15', start: '2026-09-15', end: '2026-09-16', allDay: true }]
    const r = freeFragments({ window: w, blocks, timeZone: TZ, transitBufferMin: 0, overrides: { d15: 'hard' } })
    expect(clock(r.fragments)).toBe('22:00–00:00')
    expect(clock(freeFragments({ window: w, blocks, timeZone: TZ, transitBufferMin: 15, overrides: { d15: 'hard' } }).fragments)).toBe('22:00–23:45')
  })
  it('formatFragments renders in the requested zone and marks day rollover', () => {
    const f = [{ start: '2026-09-14T14:00:00Z', end: '2026-09-14T15:45:00Z' }]
    expect(formatFragments(f, 'America/Los_Angeles')).toBe('07:00–08:45')
    expect(formatFragments([], TZ)).toBe('')
  })
})

describe('excluding the event itself', () => {
  it('a block that IS the pushed recruiting event (by id or tag) is not a conflict', () => {
    const blocks = [
      { id: 'g-main', title: 'Fall Engineering Career Fair', start: t(10), end: t(16), meta: { recruitingOs: 'event', eventId: 'ev1' } },
      { id: 'c1', start: t(12), end: t(13) },
    ]
    const r = freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ, excludeEventId: 'ev1' })
    expect(clock(r.fragments)).toBe('10:00–12:00, 13:00–16:00')
    const r2 = freeFragments({ window, blocks, transitBufferMin: 0, timeZone: TZ, excludeIds: ['g-main'] })
    expect(clock(r2.fragments)).toBe('10:00–12:00, 13:00–16:00')
  })
})

describe('conflictsForEvent (app-shape glue)', () => {
  const event = { id: 'ev1', startsAt: '2026-09-14T14:00:00Z', endsAt: '2026-09-14T20:00:00Z', timezone: TZ }
  const cal = [
    { id: 'g1', slot: 'school', title: 'EECS 281', start: t(12), end: t(13, 30), allDay: false },
    { id: 'g2', slot: 'school', title: 'MATH 215', start: t(16), end: t(17, 30), allDay: false },
    { id: 'g-main', slot: 'personal', title: 'Fair (pushed)', start: t(10), end: t(16), allDay: false, meta: { recruitingOs: 'event', eventId: 'ev1' } },
    { id: 'g-rem', slot: 'personal', title: '⏰ Due', start: t(11), end: t(11, 30), allDay: false },
  ]
  it('uses the school transit buffer, excludes the pushed event and its reminders, honours overrides', () => {
    const userEvent = { calendarEventId: 'g-main', calendarReminderIds: { 'req:r1': 'g-rem' }, blockOverrides: {} }
    const r = conflictsForEvent(event, cal, { userEvent, school: { timezone: TZ, transitBufferMin: 15 } })
    expect(r.summary).toBe('Free 10:00–11:45, 13:45–15:45')
    expect(r.windowMinutes).toBe(360)
    expect(r.fullyFree).toBe(false)
    const soft = conflictsForEvent(event, cal, { userEvent: { ...userEvent, blockOverrides: { g1: 'soft' } }, school: { timezone: TZ, transitBufferMin: 15 } })
    expect(soft.summary).toBe('Free 10:00–15:45')
    expect(soft.softOverlaps[0].id).toBe('g1')
  })
  it('defaults to a 1h window and "No conflicts"', () => {
    const r = conflictsForEvent({ id: 'x', startsAt: '2026-09-14T14:00:00Z', timezone: TZ }, [], { school: { timezone: TZ } })
    expect(r.windowMinutes).toBe(60)
    expect(r.summary).toBe('No conflicts')
  })
})
