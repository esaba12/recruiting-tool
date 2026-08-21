// Unified timeline — merges the four date signals that were previously stuck in separate
// tabs (job-board application deadlines, Google Calendar events, explicit contact
// follow-ups/schedule-by dates, and Keep in Touch's passive reconnect cadence) into one
// urgency-sorted feed. No new data plumbing: every source here is read from state/caches
// the app already maintains — this is purely a merge + sort layer.
import { jobId, lsGet } from '../components/jobBoards/helpers.js'
import { keepInTouchQueue } from './keepInTouch.js'
import { TERMINAL_STAGES, isUntriaged } from '../shared.jsx'
import { CALENDAR_SLOTS } from '../googleCalendar.js'

const EVENT_BADGE_COLOR = { personal: 'bg-accent-100 text-accent-700', school: 'bg-purple-100 text-purple-700' }

// Same cache useJobDeadlines.js writes to — read-only here, never re-extracted, since
// Job Boards already owns fetching/caching real deadlines.
const DEADLINE_CACHE_KEY = 'rec_job_deadlines'

const DAY = 86400000
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

function daysUntil(date) {
  if (!date) return null
  return Math.round((startOfDay(date) - startOfDay(Date.now())) / DAY)
}

// 'overdue' (<0d), 'soon' (0-7d, the research-backed "next 7 days" cutoff), 'later'.
export function tierFor(days) {
  if (days === null) return 'later'
  if (days < 0) return 'overdue'
  if (days <= 7) return 'soon'
  return 'later'
}

// calendarEvents: normalized Google Calendar events (see googleCalendar.js's listEvents
// shape — { id, title, start, allDay }), already fetched by the caller for whatever
// window it wants covered (CalendarTab's feed view fetches a rolling window rather than
// the single visible month the grid view uses).
export function buildTimelineItems({ contacts = [], apps = [], interactions = [], calendarEvents = [] }) {
  const items = []

  for (const ev of calendarEvents) {
    const d = ev.allDay ? new Date(`${ev.start}T00:00:00`) : new Date(ev.start)
    const days = daysUntil(d)
    items.push({
      id: `event-${ev.slot || 'personal'}-${ev.id}`, type: 'event', date: d, days, tier: tierFor(days),
      title: ev.title || 'Event',
      subtitle: ev.allDay ? 'All day' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
      badgeLabel: CALENDAR_SLOTS[ev.slot] || 'Event', badgeColor: EVENT_BADGE_COLOR[ev.slot] || 'bg-accent-100 text-accent-700',
      refType: 'event', ref: ev,
    })
  }

  for (const c of contacts) {
    if (!c.followUpDate || c.status === '✅ Closed') continue
    const days = daysUntil(c.followUpDate)
    items.push({
      id: `followup-${c.id}`, type: 'followup', date: new Date(c.followUpDate), days, tier: tierFor(days),
      title: c.name, subtitle: [c.company, c.role].filter(Boolean).join(' · ') || 'Follow-up',
      badgeLabel: 'Follow-up', badgeColor: 'bg-accent-100 text-accent-700', refType: 'contact', ref: c,
    })
  }

  for (const c of contacts) {
    if (!c.wantsToSchedule || !c.scheduleBy) continue
    const days = daysUntil(c.scheduleBy)
    items.push({
      id: `schedule-${c.id}`, type: 'schedule', date: new Date(c.scheduleBy), days, tier: tierFor(days),
      title: c.name, subtitle: [c.company, c.role].filter(Boolean).join(' · ') || 'Wants to schedule',
      badgeLabel: 'Schedule', badgeColor: 'bg-ink-100 text-ink-600', refType: 'contact', ref: c,
    })
  }

  // Keep in Touch already excludes anyone with a future explicit Follow-Up Date (no
  // double-nag) and returns only due/overdue/never-contacted — every entry here belongs.
  for (const { contact, status } of keepInTouchQueue(contacts, interactions)) {
    const days = status.never ? 0 : -status.overdueDays
    items.push({
      id: `reconnect-${contact.id}`, type: 'reconnect', date: status.never ? null : status.dueDate, days, tier: tierFor(days),
      title: contact.name,
      subtitle: status.never ? 'Never logged a touch' : `${status.overdueDays}d since due to reconnect`,
      badgeLabel: 'Reconnect', badgeColor: 'bg-warning-100 text-warning-800', refType: 'contact', ref: contact,
    })
  }

  // Real deadlines are cached per job-board listing (keyed by company::role), so an
  // application only shows one here once Job Boards has actually resolved a stated
  // deadline for it — matches the same jobId() key the badge on the board card uses.
  const deadlineCache = lsGet(DEADLINE_CACHE_KEY) || {}
  const activeApps = apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))
  for (const a of activeApps) {
    const info = deadlineCache[jobId({ company: a.company, role: a.role })]
    if (!info?.deadline) continue
    const days = daysUntil(info.deadline)
    items.push({
      id: `deadline-${a.id}`, type: 'deadline', date: new Date(info.deadline), days, tier: tierFor(days),
      title: a.company, subtitle: a.role ? `Apply by · ${a.role}` : 'Application deadline',
      badgeLabel: 'Deadline', badgeColor: 'bg-danger-50 text-danger-700', refType: 'application', ref: a,
    })
  }

  return items
}

// Sorts soonest-first (undated items sink to the end), then splits into the three tiers.
export function groupTimelineItems(items) {
  const sorted = items.slice().sort((a, b) => {
    if (a.days === null && b.days === null) return 0
    if (a.days === null) return 1
    if (b.days === null) return -1
    return a.days - b.days
  })
  return {
    overdue: sorted.filter(i => i.tier === 'overdue'),
    soon: sorted.filter(i => i.tier === 'soon'),
    later: sorted.filter(i => i.tier === 'later'),
  }
}
