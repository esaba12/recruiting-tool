// Attention-derivation module — pure filter/sort transforms over already-fetched,
// already-RLS-scoped arrays. Extracted verbatim from ActionsTab.jsx's inline computations
// (per D-06) so every attention-feed surface (this phase's TodayTab.jsx, and any future
// consumer) imports the same logic instead of re-deriving it independently.
import { TERMINAL_STAGES, daysSince, daysUntil, isUntriaged, isOverdue, isStaleApplication } from '../shared.jsx'
import { keepInTouchQueue } from './keepInTouch.js'

// ActionsTab.jsx:7 (activeApps helper, needed by staleApplications)
export function activeApps(apps) {
  return apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))
}

// ActionsTab.jsx:13-15
export function oaDue(apps) {
  return apps
    .filter(a => a.oaDueDate && !a.oaCompleted)
    .sort((a, b) => daysUntil(a.oaDueDate) - daysUntil(b.oaDueDate))
}

// ActionsTab.jsx:16-17
export function oaNeedsCheck(apps) {
  return apps.filter(a => a.oaLink && !a.oaDueDate && !a.oaCompleted && a.oaResearchCheckedAt)
}

// ActionsTab.jsx:21-28
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

// ActionsTab.jsx:30-32
export function overdueFollowUps(contacts) {
  return contacts.filter(isOverdue).sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))
}

// ActionsTab.jsx:34-40 (depends on activeApps above)
export function staleApplications(apps) {
  return activeApps(apps).filter(isStaleApplication).sort((a, b) => {
    const da = a.daysInStage ?? daysSince(a.lastActivity)
    const db = b.daysInStage ?? daysSince(b.lastActivity)
    return db - da
  })
}

// ActionsTab.jsx:42-44
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
