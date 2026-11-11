// "Up next" (v1.5 spec 03): every Today list merged into one ranked queue. Pure — it takes
// lib/todayAttention.js's already-filtered lists (layout + snoozes applied) and sorts them by
// urgency instead of by where they came from.
//
// Tiers, first matching rule wins (the table in .planning/v1.5-action-first/03-up-next-queue.md):
//   now   past due, due today, an interview within 36h, an offer due within 3 days, a
//         thank-you (48h window), a drafted reply waiting 2+ days, registration closing ≤ 2 days
//   week  due within 7 days, other replies, awaiting reply, schedule, high urgency, email to-dos
//   later stale apps, job boards to review, keep in touch, OA deadline unknown, far-off items
import { daysUntil, parseDay } from './dates.js'

const HOUR = 3600000
const DAY = 24 * HOUR

// The queue's kinds, in the order Customize lists them. `list` is the snooze list id
// (lib/todayAttention.js SNOOZE_KEY); kinds without one have their own done/skip controls.
export const QUEUE_KINDS = [
  { id: 'decisions', label: 'Offer decisions', short: 'Offer', list: 'decisions' },
  { id: 'interview', label: 'Interviews', short: 'Interview', list: 'interview' },
  { id: 'oa', label: 'OAs due', short: 'OA', list: 'oa' },
  { id: 'thankYou', label: 'Thank-yous', short: 'Thank-you', list: 'thankYou' },
  { id: 'replies', label: 'Drafted replies', short: 'Reply', list: 'replies' },
  { id: 'overdue', label: 'Overdue follow-ups', short: 'Follow-up', list: 'overdue' },
  { id: 'awaiting', label: 'Awaiting reply', short: 'Awaiting', list: 'awaiting' },
  { id: 'schedule', label: 'Want to schedule', short: 'Schedule', list: 'schedule' },
  { id: 'urgent', label: 'High urgency', short: 'Urgent', list: 'urgent' },
  { id: 'email', label: 'From your email', short: 'Email', list: null },
  { id: 'events', label: 'Event steps', short: 'Event', list: null },
  { id: 'stale', label: 'Stale applications', short: 'Stale', list: 'stale' },
  { id: 'review', label: 'Job boards to review', short: 'Review', list: 'review' },
  { id: 'keepInTouch', label: 'Keep in touch', short: 'Keep in touch', list: 'keepInTouch' },
  { id: 'oaCheck', label: 'OA deadline unknown', short: 'OA', list: 'oaCheck' },
]
export const KIND = Object.fromEntries(QUEUE_KINDS.map(k => [k.id, k]))
export const TIERS = ['now', 'week', 'later']

// A due date by calendar day: today or earlier → now, within a week → week, else later.
function byDay(day, now) {
  const d = daysUntil(day, now)
  if (d === null) return 'week'
  return d <= 0 ? 'now' : d <= 7 ? 'week' : 'later'
}
// The same for an instant (event deadlines are timestamps).
function byInstant(ms, now) {
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999)
  return ms <= endOfToday.getTime() ? 'now' : ms <= now + 7 * DAY ? 'week' : 'later'
}
const dayMs = d => (d ? parseDay(d).getTime() : null)
const ms = d => (d ? new Date(d).getTime() : null)

function item(kind, key, row, tier, due = null, since = null) {
  return { kind, key, row, tier, due, since }
}

// attention: the object deriveTodayAttention returns.
export function buildActionQueue(attention, { now = Date.now() } = {}) {
  const { decisions = [], replyDrafts = [], openItems = [], peopleGroups = {}, appGroups = {}, eventAttention = {} } = attention
  const p = name => peopleGroups[name] || []
  const a = name => appGroups[name] || []
  const out = []

  for (const app of decisions) {
    const d = app.offerDeadline ? daysUntil(app.offerDeadline, now) : null
    out.push(item('decisions', `decisions:${app.id}`, app, d !== null && d <= 3 ? 'now' : 'week', dayMs(app.offerDeadline)))
  }
  for (const app of a('interview')) {
    const t = ms(app.interviewAt)
    out.push(item('interview', `interview:${app.id}`, app, t - now <= 36 * HOUR ? 'now' : t - now <= 7 * DAY ? 'week' : 'later', t))
  }
  for (const app of a('oa')) out.push(item('oa', `oa:${app.id}`, app, byDay(app.oaDueDate, now), dayMs(app.oaDueDate)))
  for (const row of p('thankYou')) out.push(item('thankYou', `thankYou:${row.id}`, row, 'now', null, ms(row.at)))
  for (const d of replyDrafts) {
    const created = ms(d.createdAt)
    out.push(item('replies', `replies:${d.id}`, d, created && now - created >= 2 * DAY ? 'now' : 'week', null, created))
  }
  for (const c of p('overdue')) out.push(item('overdue', `overdue:${c.id}`, c, 'now', dayMs(c.followUpDate)))
  for (const x of p('awaiting')) out.push(item('awaiting', `awaiting:${x.contact.id}`, x, 'week', null, dayMs(x.lastInteraction?.date)))
  for (const c of p('schedule')) out.push(item('schedule', `schedule:${c.id}`, c, c.scheduleBy ? (byDay(c.scheduleBy, now) === 'now' ? 'now' : 'week') : 'week', dayMs(c.scheduleBy)))
  for (const c of p('urgent')) out.push(item('urgent', `urgent:${c.id}`, c, 'week', dayMs(c.followUpDate)))
  for (const i of openItems) {
    out.push(item('email', `email:${i.id}`, i, i.dueDate ? (byDay(i.dueDate, now) === 'now' ? 'now' : 'week') : 'week', dayMs(i.dueDate), ms(i.createdAt)))
  }
  for (const s of eventAttention.steps || []) {
    out.push(item('events', `step:${s.event.id}:${s.requirement?.id ?? s.requirement?.kind}`, { type: 'step', ...s }, s.overdue ? 'now' : byInstant(s.dueMs, now), s.dueMs))
  }
  for (const r of eventAttention.registrations || []) {
    out.push(item('events', `registration:${r.event.id}`, { type: 'registration', ...r }, r.dueMs - now <= 2 * DAY ? 'now' : 'week', r.dueMs))
  }
  for (const f of eventAttention.followUps || []) {
    out.push(item('events', `eventFollowUp:${f.userEvent.id ?? f.userEvent.eventId}`, { type: 'followUp', ...f }, 'now', ms(f.userEvent.followupDueAt)))
  }
  for (const app of a('stale')) out.push(item('stale', `stale:${app.id}`, app, 'later', null, dayMs(app.lastActivity)))
  for (const app of a('review')) out.push(item('review', `review:${app.id}`, app, 'later', null, ms(app.createdTime)))
  for (const x of p('keepInTouch')) out.push(item('keepInTouch', `keepInTouch:${x.contact.id}`, x, 'later'))
  for (const app of a('oaCheck')) out.push(item('oaCheck', `oaCheck:${app.id}`, app, 'later'))

  // Dated items first, soonest due; then undated, oldest first; ties keep list order.
  const order = (x, y) => {
    if (x.due !== null || y.due !== null) {
      if (x.due === null) return 1
      if (y.due === null) return -1
      if (x.due !== y.due) return x.due - y.due
    }
    if (x.since !== null && y.since !== null) return x.since - y.since
    return 0
  }
  const tiers = Object.fromEntries(TIERS.map(t => [t, out.filter(i => i.tier === t).sort(order)]))
  return { ...tiers, count: tiers.now.length + tiers.week.length }
}

// The earliest future dated item, for the "Nothing due" line.
export function nextUp(queue) {
  return [...queue.week, ...queue.later].filter(i => i.due !== null).sort((a, b) => a.due - b.due)[0] || null
}

// "Backlog · 14: 8 stale, 2 to review…" summary parts, in QUEUE_KINDS order.
export function backlogSummary(later) {
  const counts = new Map()
  for (const i of later) counts.set(i.kind, (counts.get(i.kind) || 0) + 1)
  return QUEUE_KINDS.filter(k => counts.has(k.id)).map(k => ({ kind: k.id, label: k.label, count: counts.get(k.id) }))
}
