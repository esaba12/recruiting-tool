// Attention-derivation module — pure filter/sort transforms over already-fetched,
// already-RLS-scoped arrays. Extracted verbatim from the former Actions tab's inline
// computations (per D-06) so every attention-feed surface (this phase's TodayTab.jsx, and
// any future consumer) imports the same logic instead of re-deriving it independently.
import { TERMINAL_STAGES, daysSince, daysUntil, isUntriaged, isOverdue, isStaleApplication } from '../shared.jsx'
import { keepInTouchQueue } from './keepInTouch.js'

// Former Actions tab's activeApps helper, needed by staleApplications
export function activeApps(apps) {
  return apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))
}

// Ported verbatim from the former Actions tab
export function oaDue(apps) {
  return apps
    .filter(a => a.oaDueDate && !a.oaCompleted)
    .sort((a, b) => daysUntil(a.oaDueDate) - daysUntil(b.oaDueDate))
}

// Ported verbatim from the former Actions tab
export function oaNeedsCheck(apps) {
  return apps.filter(a => a.oaLink && !a.oaDueDate && !a.oaCompleted && a.oaResearchCheckedAt)
}

// Ported verbatim from the former Actions tab
export function wantToSchedule(contacts) {
  return contacts
    .filter(c => c.wantsToSchedule)
    .sort((a, b) => {
      if (!a.scheduleBy && !b.scheduleBy) return 0
      if (!a.scheduleBy) return 1
      if (!b.scheduleBy) return -1
      return new Date(a.scheduleBy) - new Date(b.scheduleBy)
    })
}

// Ported verbatim from the former Actions tab
export function overdueFollowUps(contacts) {
  return contacts.filter(isOverdue).sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))
}

// Ported verbatim from the former Actions tab (depends on activeApps above)
export function staleApplications(apps) {
  return activeApps(apps).filter(isStaleApplication).sort((a, b) => {
    const da = a.daysInStage ?? daysSince(a.lastActivity)
    const db = b.daysInStage ?? daysSince(b.lastActivity)
    return db - da
  })
}

// Ported verbatim from the former Actions tab
export function highUrgencyContacts(contacts) {
  return contacts.filter(c =>
    c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
  )
}

// NEW — mirrors RESEARCH.md's exact spec, source #7
export function needsReviewApps(apps) {
  return apps.filter(a => a.triage === 'Needs Review' && a.stage === 'Wishlist')
}

// Thin re-export, do NOT duplicate lib/keepInTouch.js's cadence math
export { keepInTouchQueue as keepInTouchDue } from './keepInTouch.js'

// ── Recruiting Events (v1.1) ─────────────────────────────────────────────────
// Same contract as everything above: pure derivations over already-fetched,
// RLS-scoped arrays, consumed by TodayTab's Section stack — NOT a second action queue.
import { requirementsDue } from './eventRequirements.js'

// Incomplete required signup steps due within `withinDays` (overdue first).
// → [{ event, requirement, overdue, daysUntil }]
export function eventRequirementsDue(events, completions, { now = Date.now(), withinDays = 7, userEvents = [] } = {}) {
  const skipped = new Set(userEvents.filter(u => u.status === 'skipped' || u.status === 'attended').map(u => u.eventId))
  const out = []
  for (const ev of events) {
    if (skipped.has(ev.id)) continue
    if (Date.parse(ev.startsAt) < now) continue
    for (const r of requirementsDue(ev.requirements || [], completions, { now, withinDays })) {
      out.push({ event: ev, requirement: r, overdue: r.overdue, daysUntil: r.daysUntil, dueMs: r.dueMs })
    }
  }
  return out.sort((a, b) => a.dueMs - b.dueMs)
}

// Registration windows closing within `withinDays` for events the user hasn't skipped
// and hasn't already confirmed. → [{ event, daysUntil, overdue }]
export function registrationClosingSoon(events, userEvents = [], { now = Date.now(), withinDays = 7 } = {}) {
  const state = new Map(userEvents.map(u => [u.eventId, u]))
  return events
    .filter(ev => ev.registrationDeadline && Date.parse(ev.startsAt) >= now)
    .filter(ev => !['skipped', 'confirmed', 'attended'].includes(state.get(ev.id)?.status))
    .map(ev => { const ms = Date.parse(ev.registrationDeadline); return { event: ev, dueMs: ms, overdue: ms < now, daysUntil: Math.ceil((ms - now) / 86400000) } })
    .filter(x => x.dueMs <= now + withinDays * 86400000)
    .sort((a, b) => a.dueMs - b.dueMs)
}

// Post-event follow-ups the user set and hasn't closed. → [{ event, userEvent, daysOverdue }]
export function eventFollowUpsOverdue(userEvents, events, { now = Date.now() } = {}) {
  const byId = new Map(events.map(e => [e.id, e]))
  return userEvents
    .filter(u => u.followupDueAt && !u.followupDoneAt && Date.parse(u.followupDueAt) <= now)
    .map(u => ({ userEvent: u, event: byId.get(u.eventId) || null, daysOverdue: Math.floor((now - Date.parse(u.followupDueAt)) / 86400000) }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}

// Feed sources currently marked degraded (freshness gate tripped / fetch failing).
export function degradedEventSources(sources) {
  return (sources || []).filter(s => s.degradedAt).sort((a, b) => Date.parse(b.degradedAt) - Date.parse(a.degradedAt))
}
