import { wallClock, localToUtcMs, isValidTimeZone } from './ingest/tz.js'

// Call-time availability (v1.4 spec 10). Saved in user_settings 'availability' from the
// onboarding Calendar step or Settings; read by the Gmail scan to offer free slots in a
// reply draft. Pure, so the server (api/_lib/emailPipeline.js) imports it from here.
//   { days: [0-6, 0 = Sunday], start: hour, end: hour, slotMin: minutes, timeZone: IANA }

export const AVAILABILITY_SETTING_KEY = 'availability'
export const SLOT_LENGTHS = [15, 30, 45, 60]
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function defaultAvailability(timeZone = browserTimeZone()) {
  return { days: [1, 2, 3, 4, 5], start: 9, end: 18, slotMin: 30, timeZone }
}

function browserTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York' } catch { return 'America/New_York' }
}

// A usable availability or null (unset, or nothing that could ever produce a slot).
export function normalizeAvailability(v) {
  if (!v || typeof v !== 'object') return null
  const days = [...new Set((v.days || []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
  const start = Number(v.start), end = Number(v.end)
  const slotMin = SLOT_LENGTHS.includes(Number(v.slotMin)) ? Number(v.slotMin) : 30
  if (!days.length || !(start >= 0 && end <= 24 && end > start)) return null
  if (end * 60 - start * 60 < slotMin) return null
  const timeZone = v.timeZone && isValidTimeZone(v.timeZone) ? v.timeZone : 'America/New_York'
  return { days, start, end, slotMin, timeZone }
}

const STEP_MIN = 30
const DAY_MS = 86400000

// Up to `count` free slots over the next `workingDays` available days, at least `leadHours`
// out, one per day where possible, at varied times of day so the other person has real
// choices. busy: [{ start, end }] (ISO or ms) from Google freeBusy, any calendars merged.
export function suggestSlots({ busy = [], availability, now = Date.now(), count = 3, workingDays = 5, leadHours = 18 }) {
  const a = normalizeAvailability(availability)
  if (!a) return []
  const blocks = busy.map(b => [new Date(b.start).getTime(), new Date(b.end).getTime()]).filter(([s, e]) => e > s)
  const earliest = now + leadHours * 3600000
  const slotMs = a.slotMin * 60000
  const today = wallClock(now, a.timeZone)

  // Free starts per available day, in order.
  const days = []
  for (let offset = 0; offset < 21 && days.length < workingDays; offset++) {
    const date = new Date(Date.UTC(today.y, today.m - 1, today.d) + offset * DAY_MS)
    if (!a.days.includes(date.getUTCDay())) continue
    const ymd = { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
    // Days whose window closes before the lead time don't count toward the days looked at.
    if (localToUtcMs({ ...ymd, hh: a.end }, a.timeZone) <= earliest) continue
    const free = []
    for (let min = a.start * 60; min + a.slotMin <= a.end * 60; min += STEP_MIN) {
      const start = localToUtcMs({ ...ymd, hh: Math.floor(min / 60), mm: min % 60 }, a.timeZone)
      const end = start + slotMs
      if (start < earliest) continue
      if (blocks.some(([s, e]) => s < end && e > start)) continue
      free.push({ start, end, min })
    }
    days.push(free)
  }

  // Rotate the preferred time of day (late morning, mid-afternoon, early afternoon...).
  const span = (a.end - a.start) * 60
  const preferred = [0.2, 0.65, 0.4, 0.85, 0].map(f => a.start * 60 + Math.round(span * f / STEP_MIN) * STEP_MIN)
  const picks = []
  const pickNear = (free, target) => free.reduce((best, s) => (!best || Math.abs(s.min - target) < Math.abs(best.min - target) ? s : best), null)
  const withSlots = days.filter(f => f.length)
  for (let round = 0; picks.length < count && round < 3; round++) {
    for (const free of withSlots) {
      if (picks.length >= count) break
      const left = free.filter(s => !picks.some(p => p.start < s.end && p.end > s.start))
      const slot = pickNear(left, preferred[(picks.length + round) % preferred.length])
      if (slot) picks.push(slot)
    }
  }
  return picks
    .sort((x, y) => x.start - y.start)
    .map(s => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString() }))
}

// "Tue, Oct 21, 2:00 – 2:30 PM EDT"
export function formatSlot(slot, timeZone) {
  const start = new Date(slot.start), end = new Date(slot.end)
  const day = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' }).format(start)
  const time = d => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(d)
  const zone = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(start).find(p => p.type === 'timeZoneName')?.value || ''
  return `${day}, ${time(start)} – ${time(end)}${zone ? ` ${zone}` : ''}`
}
