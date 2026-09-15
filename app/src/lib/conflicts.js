// Conflict engine — free FRAGMENTS, not a boolean.
//
// Subtracts the user's calendar blocks (both slots: personal + school, where the
// school slot is the class schedule) from an event's window and returns the
// usable pieces, minus a transit buffer around every hard block. For a
// 10:00–16:00 fair against class 12:00–13:30 and 16:00–17:30 with 15 min
// transit: "Free 10:00–11:45 and 13:45–15:45".
//
// Hard vs soft: timed blocks are HARD by default (attendance required); a
// block's own `soft` flag or a per-block override (`user_events.block_overrides`,
// { [blockId]: 'soft' | 'hard' }) flips it. All-day blocks default SOFT — an
// all-day marker ("Homecoming Week", a holiday) rarely means "can't leave the
// room", and treating it as hard would zero every fragment on that day; the
// override to 'hard' is one click away. Soft blocks never remove time but are
// reported as overlaps so the UI can say "overlaps EECS 485 (recorded), 60 min".
//
// Time: all arithmetic is epoch-ms, so ISO strings in any offset mix freely.
// All-day blocks carry bare dates (Google's end date is exclusive) and are
// interpreted in `timeZone` via lib/ingest/tz.js. Pure, no I/O.
import { localToUtcMs, wallClock } from './ingest/tz.js'

const MIN = 60000

function toMs(v, tz) {
  if (v == null) return NaN
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return localToUtcMs({ y, m, d }, tz)
  }
  return new Date(v).getTime()
}

export function isSoft(block, overrides = {}) {
  const o = overrides[block.id]
  if (o === 'soft') return true
  if (o === 'hard') return false
  if (block.soft === true) return true
  if (block.soft === false) return false
  return !!block.allDay
}

// Annotate each block with its effective classification.
export function classifyBlocks(blocks, { overrides = {} } = {}) {
  return (blocks || []).map(b => ({ ...b, effective: isSoft(b, overrides) ? 'soft' : 'hard' }))
}

function mergeIntervals(list) {
  const sorted = [...list].sort((a, b) => a.s - b.s)
  const out = []
  for (const iv of sorted) {
    const last = out[out.length - 1]
    if (last && iv.s <= last.e) last.e = Math.max(last.e, iv.e)
    else out.push({ s: iv.s, e: iv.e })
  }
  return out
}

// window: { start, end } · blocks: [{ id, title?, start, end, allDay?, soft?, meta? }]
// → { fragments: [{ start, end, minutes }], totalFreeMinutes, hardBlocks, softBlocks, softOverlaps }
export function freeFragments({
  window, blocks = [], transitBufferMin = 15, minFragmentMin = 15, timeZone = 'UTC',
  overrides = {}, excludeIds = [], excludeEventId = null,
}) {
  const ws = toMs(window.start, timeZone)
  const we = toMs(window.end, timeZone)
  if (Number.isNaN(ws) || Number.isNaN(we) || we <= ws) return { fragments: [], totalFreeMinutes: 0, hardBlocks: [], softBlocks: [], softOverlaps: [] }

  const excluded = new Set(excludeIds)
  const buffer = Math.max(0, transitBufferMin) * MIN
  const relevant = []
  for (const b of blocks) {
    if (excluded.has(b.id)) continue
    if (excludeEventId && b.meta?.recruitingOs && b.meta.eventId === excludeEventId) continue
    const s = toMs(b.start, timeZone)
    const e = toMs(b.end, timeZone)
    if (Number.isNaN(s) || Number.isNaN(e) || e <= s) continue
    const soft = isSoft(b, overrides)
    // A hard block just outside the window still matters through its transit buffer
    // (a class starting right as the fair ends means leaving 15 min early); a soft
    // block only matters if it genuinely overlaps.
    const reach = soft ? 0 : buffer
    if (e + reach <= ws || s - reach >= we) continue
    relevant.push({ block: b, s, e, soft })
  }

  const hard = relevant.filter(r => !r.soft)
  const soft = relevant.filter(r => r.soft)

  // Hard blocks + transit buffer, clipped to the window, merged.
  const busy = mergeIntervals(hard.map(r => ({ s: Math.max(ws, r.s - buffer), e: Math.min(we, r.e + buffer) })))

  const fragments = []
  let cursor = ws
  for (const iv of busy) {
    if (iv.s > cursor) fragments.push({ s: cursor, e: iv.s })
    cursor = Math.max(cursor, iv.e)
  }
  if (cursor < we) fragments.push({ s: cursor, e: we })

  const kept = fragments
    .filter(f => f.e - f.s >= minFragmentMin * MIN)
    .map(f => ({ start: new Date(f.s).toISOString(), end: new Date(f.e).toISOString(), minutes: Math.round((f.e - f.s) / MIN) }))

  const softOverlaps = soft.map(r => ({
    id: r.block.id, title: r.block.title || null, start: r.block.start, end: r.block.end,
    overlapMinutes: Math.round((Math.min(we, r.e) - Math.max(ws, r.s)) / MIN),
  }))

  return {
    fragments: kept,
    totalFreeMinutes: kept.reduce((n, f) => n + f.minutes, 0),
    hardBlocks: hard.map(r => r.block),
    softBlocks: soft.map(r => r.block),
    softOverlaps,
  }
}

// "10:00–11:45, 13:45–15:45" in the given zone (24h); a fragment ending exactly at
// midnight renders as 00:00.
export function formatFragments(fragments, timeZone = 'UTC') {
  const hhmm = iso => { const w = wallClock(new Date(iso).getTime(), timeZone); return `${String(w.hh).padStart(2, '0')}:${String(w.mm).padStart(2, '0')}` }
  return (fragments || []).map(f => `${hhmm(f.start)}–${hhmm(f.end)}`).join(', ')
}

// Longest fragment first — the "best single window to be there" for a day plan.
export function bestFragment(fragments) {
  return [...(fragments || [])].sort((a, b) => b.minutes - a.minutes)[0] || null
}

// Glue for the app's own shapes: a pool event + googleCalendar.js listEvents()
// output (both slots) + the user's per-block overrides + the school's transit
// buffer → freeFragments(). Events with no end default to a 1-hour window.
export function conflictsForEvent(event, calendarEvents = [], { userEvent, school, transitBufferMin, minFragmentMin } = {}) {
  const start = event.startsAt
  const end = event.endsAt || new Date(Date.parse(event.startsAt) + 3600000).toISOString()
  const timeZone = event.timezone || school?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const blocks = calendarEvents.map(e => ({
    id: e.id, title: e.title, start: e.start, end: e.end, allDay: !!e.allDay, slot: e.slot, meta: e.meta || null,
  }))
  const r = freeFragments({
    window: { start, end }, blocks,
    transitBufferMin: transitBufferMin ?? school?.transitBufferMin ?? 15,
    minFragmentMin: minFragmentMin ?? 15,
    timeZone,
    overrides: userEvent?.blockOverrides || {},
    excludeEventId: event.id,
    excludeIds: [userEvent?.calendarEventId, ...Object.values(userEvent?.calendarReminderIds || {})].filter(Boolean),
  })
  const windowMinutes = Math.round((Date.parse(end) - Date.parse(start)) / MIN)
  return {
    ...r,
    timeZone,
    windowMinutes,
    fullyFree: r.hardBlocks.length === 0,
    summary: r.hardBlocks.length === 0
      ? 'No conflicts'
      : r.fragments.length ? `Free ${formatFragments(r.fragments, timeZone)}` : 'No usable window',
  }
}
