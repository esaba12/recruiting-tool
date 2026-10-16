// Pure view helpers for Calendar → Events (components/events/EventsView.jsx) and
// the event detail panel (components/panels/EventPanelBody.jsx): filter chips,
// day grouping in the event's own timezone, employer-name resolution, and the
// countdown / next-step / stale labels rows render. No React, no I/O — `now` is
// injectable everywhere so test/eventView.test.js can pin time.
import { requirementLadder, REQUIREMENT_LABEL } from './eventRequirements.js'
import { isStale } from './ingest/freshness.js'
import { wallClock } from './ingest/tz.js'

const HOUR = 3600000
const DAY = 86400000
const LOCAL_TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } })()

// ── labels ──────────────────────────────────────────────────────────────────

const KIND_ORDER = ['career_fair', 'info_session', 'coffee_chat', 'networking', 'workshop', 'other']
const KIND_LABELS = {
  career_fair: 'Career fair', info_session: 'Info session', coffee_chat: 'Coffee chat',
  networking: 'Networking', workshop: 'Workshop', other: 'Other',
}
export function kindLabel(kind) {
  if (KIND_LABELS[kind]) return KIND_LABELS[kind]
  const s = String(kind || 'other').replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export const STATUS_OPTIONS = ['interested', 'registering', 'confirmed', 'attended', 'skipped']
export const STATUS_LABEL = {
  interested: 'Interested', registering: 'Registering', confirmed: 'Going', attended: 'Attended', skipped: 'Skipped',
}

export const TIER_LABEL = { high: 'High', medium: 'Medium', low: 'Low' }

// ── time ────────────────────────────────────────────────────────────────────

// Events with no end are treated as one hour long (same rule as conflictsForEvent).
export function eventEndMs(ev) {
  const end = Date.parse(ev.endsAt)
  if (!Number.isNaN(end)) return end
  return Date.parse(ev.startsAt) + HOUR
}

export function eventZone(ev, fallbackTz = LOCAL_TZ) {
  return ev?.timezone || fallbackTz || 'UTC'
}

const pad = n => String(n).padStart(2, '0')

export function dayKeyInZone(isoOrMs, tz = LOCAL_TZ) {
  const w = wallClock(typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs), tz)
  return `${w.y}-${pad(w.m)}-${pad(w.d)}`
}

const dayKeyUtcMs = key => { const [y, m, d] = key.split('-').map(Number); return Date.UTC(y, m - 1, d) }

const DAY_LABEL_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
// "2026-10-22" → "Thu Oct 22"
export function dayLabel(key) {
  const p = Object.fromEntries(DAY_LABEL_FMT.formatToParts(new Date(dayKeyUtcMs(key) + 12 * HOUR)).map(x => [x.type, x.value]))
  return `${p.weekday} ${p.month} ${p.day}`
}

export function countdownLabel(days) {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1) return `in ${days}d`
  if (days === -1) return 'yesterday'
  return `${Math.abs(days)}d ago`
}

const hhmm = (ms, tz) => { const w = wallClock(ms, tz); return `${pad(w.hh)}:${pad(w.mm)}` }

// "10:00–16:00" in the event's zone (24h). "All day" for all-day rows.
export function timeRangeLabel(ev, fallbackTz) {
  if (ev.allDay) return 'All day'
  const tz = eventZone(ev, fallbackTz)
  const start = hhmm(Date.parse(ev.startsAt), tz)
  const end = Date.parse(ev.endsAt)
  return Number.isNaN(end) ? start : `${start}–${hhmm(end, tz)}`
}

// Short zone name ("EDT") for the panel, so a viewer in another zone knows which clock.
export function zoneAbbrev(ev, fallbackTz) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: eventZone(ev, fallbackTz), timeZoneName: 'short' }).formatToParts(new Date(ev.startsAt))
    return p.find(x => x.type === 'timeZoneName')?.value || ''
  } catch { return '' }
}

// Groups events by local day (in each event's own zone) → [{ key, label, daysUntil, events }].
// `order: 'desc'` for the Past chip (newest day first); events inside a day are always chronological.
export function groupByDay(events, { now = Date.now(), fallbackTz = LOCAL_TZ, order = 'asc' } = {}) {
  const groups = new Map()
  for (const ev of events) {
    const tz = eventZone(ev, fallbackTz)
    const key = dayKeyInZone(ev.startsAt, tz)
    if (!groups.has(key)) {
      const todayKey = dayKeyInZone(now, tz)
      groups.set(key, { key, label: dayLabel(key), daysUntil: Math.round((dayKeyUtcMs(key) - dayKeyUtcMs(todayKey)) / DAY), events: [] })
    }
    groups.get(key).events.push(ev)
  }
  const out = [...groups.values()]
  for (const g of out) g.events.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
  out.sort((a, b) => (order === 'desc' ? -1 : 1) * a.key.localeCompare(b.key))
  return out
}

// ── filters ─────────────────────────────────────────────────────────────────

export const EVENT_FILTERS = [
  { key: 'forYou', label: 'For you' },
  { key: 'upcoming', label: 'All upcoming' },
  { key: 'going', label: 'Registering / Going' },
  { key: 'past', label: 'Past' },
  { key: 'dismissed', label: 'Dismissed' },
]

// tier: eventPool.tierOf(ev) ('high'|'medium'|'low'|'dismissed'|null) · status: user_events.status
export function eventFacts(ev, { tier = null, status = null, now = Date.now() } = {}) {
  return { ev, tier, status, dismissed: tier === 'dismissed', past: eventEndMs(ev) < now }
}

const GOING = new Set(['registering', 'confirmed'])
const PREDICATES = {
  forYou: f => !f.past && !f.dismissed && (f.tier === 'high' || f.tier === 'medium'),
  upcoming: f => !f.past && !f.dismissed,
  // An event you're registering for/going to never hides just because it was dismissed.
  going: f => !f.past && GOING.has(f.status),
  past: f => f.past && !f.dismissed,
  dismissed: f => f.dismissed,
}

export function matchesFilter(key, facts) {
  return (PREDICATES[key] || PREDICATES.upcoming)(facts)
}

export function filterCounts(factsList) {
  const counts = Object.fromEntries(EVENT_FILTERS.map(f => [f.key, 0]))
  for (const f of factsList) for (const k of Object.keys(counts)) if (PREDICATES[k](f)) counts[k]++
  return counts
}

export function kindsPresent(events) {
  const kinds = [...new Set(events.map(e => e.kind || 'other'))]
  const rank = k => { const i = KIND_ORDER.indexOf(k); return i === -1 ? KIND_ORDER.length : i }
  return kinds.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

export function matchesSearch(ev, query, employerNames = []) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return true
  return [ev.title, ev.location, ...employerNames].some(s => (s || '').toLowerCase().includes(q))
}

// ── employers ───────────────────────────────────────────────────────────────

// Host employer first, then every attending employer (multi-employer fairs), deduped.
// Falls back to the enrichment's free-text employer when no id resolves.
export function employerNamesFor(ev, employersById) {
  const ids = [ev.employerId, ...(ev.attributes?.employerIds || [])].filter(Boolean)
  const names = []
  for (const id of ids) {
    const name = employersById?.get(id)?.name
    if (name && !names.includes(name)) names.push(name)
  }
  if (!names.length && ev.attributes?.employer) names.push(ev.attributes.employer)
  return names
}

export function formatEmployerList(names, max = 2) {
  if (!names?.length) return ''
  const shown = names.slice(0, max).join(', ')
  return names.length > max ? `${shown} +${names.length - max}` : shown
}

// ── countdowns ──────────────────────────────────────────────────────────────

// → { label, overdue, soon } | null. Under a day reads in hours; past due reads as overdue.
// Whole calendar days between two instants in `tz` (what "in 2d" means to a person, and
// what Today's countdowns use) — Fri 17:40 → Sun 12:00 is 2, not 1.
export function calendarDaysBetween(fromMs, toMs, tz = LOCAL_TZ) {
  return Math.round((Date.parse(`${dayKeyInZone(toMs, tz)}T00:00:00Z`) - Date.parse(`${dayKeyInZone(fromMs, tz)}T00:00:00Z`)) / DAY)
}

// 'due in 5h' (later today) · 'due tomorrow' · 'due in 3d' · 'overdue' (earlier today) · '2d overdue'.
export function dueLabel(dueAt, now = Date.now(), tz = LOCAL_TZ) {
  const t = Date.parse(dueAt)
  if (!dueAt || Number.isNaN(t)) return null
  const diff = t - now
  const days = calendarDaysBetween(now, t, tz)
  if (diff < 0) return { label: days <= -1 ? `${-days}d overdue` : 'overdue', overdue: true, soon: false }
  const label = days <= 0 ? `due in ${Math.max(1, Math.floor(diff / HOUR))}h` : days === 1 ? 'due tomorrow' : `due in ${days}d`
  return { label, overdue: false, soon: diff < 3 * DAY }
}

export function requirementName(step) {
  return step.label || REQUIREMENT_LABEL[step.kind] || kindLabel(step.kind)
}

// First incomplete REQUIRED step → { step, name, due, text: 'Next: Upload résumé · due in 2d', overdue, soon } | null.
export function nextStepInfo(ev, completions, now = Date.now()) {
  const step = requirementLadder(ev.requirements, completions).find(r => !r.completed && r.required !== false)
  if (!step) return null
  const due = dueLabel(step.dueAt, now, eventZone(ev))
  return {
    step,
    name: requirementName(step),
    due: due?.label || null,
    text: `Next: ${requirementName(step)}${due ? ` · ${due.label}` : ''}`,
    overdue: !!due?.overdue,
    soon: !!due?.soon,
  }
}

// Registration deadline within 7 days and not yet passed → { label, urgent } | null.
export function registrationCountdown(ev, now = Date.now()) {
  const t = Date.parse(ev.registrationDeadline)
  if (!ev.registrationDeadline || Number.isNaN(t)) return null
  const diff = t - now
  if (diff <= 0 || diff > 7 * DAY) return null
  const days = calendarDaysBetween(now, t, eventZone(ev))
  const span = days <= 0 ? `in ${Math.max(1, Math.floor(diff / HOUR))}h` : days === 1 ? 'tomorrow' : `in ${days}d`
  return { label: `Reg. closes ${span}`, urgent: diff < 2 * DAY }
}

// Source not re-verified in >14d → { days, label } | null (same rule the scorer caps on).
export function staleInfo(ev, now = Date.now()) {
  if (!isStale(ev.sourceLastVerifiedAt, { now })) return null
  const t = Date.parse(ev.sourceLastVerifiedAt)
  if (Number.isNaN(t)) return { days: null, label: 'stale · never verified' }
  const days = Math.floor((now - t) / DAY)
  return { days, label: `stale · last verified ${days}d ago` }
}

// "Thu Oct 22 · 23:59" in the given zone — deadlines and due dates in the panel.
export function dateTimeLabel(iso, tz = LOCAL_TZ) {
  const ms = Date.parse(iso)
  if (!iso || Number.isNaN(ms)) return ''
  return `${dayLabel(dayKeyInZone(ms, tz))} · ${hhmm(ms, tz)}`
}
