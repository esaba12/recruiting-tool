// Snooze to a date (v1.5 spec 04). Pure: what the ✕ menu offers, and whether a stored snooze
// still applies. A stored snooze is { until, due } (older ones are a bare untilMs number): `due`
// is the item's date when it was snoozed, so moving that date (a new OA deadline, a rescheduled
// interview) brings the item back early.
const DAY = 86400000

export function snoozeEntry(v) {
  if (v == null) return null
  return typeof v === 'number' ? { until: v, due: null } : { until: v.until || 0, due: v.due ?? null }
}

export function snoozeActive(stored, { now = Date.now(), due = null } = {}) {
  const e = snoozeEntry(stored)
  if (!e || e.until <= now) return false
  return e.due == null || due == null || e.due === due
}

// The date that, when it changes, ends a snooze early. Keyed by snooze list.
const DUE_OF = {
  oa: a => a.oaDueDate, oaCheck: a => a.oaDueDate, interview: a => a.interviewAt, decisions: a => a.offerDeadline,
  overdue: c => c.followUpDate, schedule: c => c.scheduleBy, urgent: c => c.followUpDate,
}
export const dueOf = (list, row) => (DUE_OF[list] ? DUE_OF[list](row) ?? null : null)

// 8:00 local on the day `days` after `from`'s day.
function morning(from, days) {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  d.setHours(8, 0, 0, 0)
  return d.getTime()
}

// The ✕ menu for a queue item ({ kind, row, due }): [{ id, label, until }].
export function snoozeOptions(item = {}, { now = Date.now() } = {}) {
  const out = [{ id: 'tomorrow', label: 'Tomorrow', until: morning(now, 1) }]
  const weekday = new Date(now).getDay() // 0 Sunday
  if (weekday !== 0) out.push({ id: 'monday', label: 'Monday', until: morning(now, ((8 - weekday) % 7) || 7) })
  out.push({ id: 'week', label: 'Next week', until: now + 7 * DAY })
  const interviewAt = item.row?.interviewAt ? new Date(item.row.interviewAt).getTime() : null
  if (interviewAt && interviewAt > now) {
    out.push({ id: 'interview', label: 'After the interview', until: morning(interviewAt, 1) })
  } else if (item.due != null && item.due > now) {
    out.push({ id: 'deadline', label: 'After the deadline', until: morning(item.due, 1) })
  }
  return out
}

// "back Mon" / "back tomorrow" / "back Nov 20" for the Unhide list.
export function backLabel(until, now = Date.now()) {
  const days = Math.round((new Date(until).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY)
  if (days <= 0) return 'back later today'
  if (days === 1) return 'back tomorrow'
  if (days < 7) return `back ${new Date(until).toLocaleDateString('en-US', { weekday: 'short' })}`
  return `back ${new Date(until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}
