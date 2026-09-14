// Requirement gating for Recruiting Events — the multi-step signup ladder.
//
// Pure derivations over event_requirements (shared, per event) and
// user_event_requirement_completions (per user). The one hard rule lives here:
// a user's event is never `confirmed` until every REQUIRED step has a
// completed_at. Kept out of Postgres on purpose — it's a cross-table check the
// client needs to render (the checklist) and the writer needs to enforce, so
// one function serves both.

export const REQUIREMENT_KINDS = [
  'register',
  'email_recruiter_to_confirm',
  'rsvp_external',
  'upload_resume',
  'apply_first',
  'invite_only_selection',
]

export const REQUIREMENT_LABEL = {
  register: 'Register',
  email_recruiter_to_confirm: 'Email recruiter to confirm',
  rsvp_external: 'RSVP on external site',
  upload_resume: 'Upload résumé',
  apply_first: 'Apply to the role first',
  invite_only_selection: 'Invite-only selection',
}

// completions: [{ requirementId, completedAt }] or a Set/Map keyed by requirementId
function completedIds(completions) {
  if (completions instanceof Set) return completions
  if (completions instanceof Map) return new Set(completions.keys())
  return new Set((completions || []).filter(c => c.completedAt).map(c => c.requirementId))
}

// Steps for one event in ladder order, each annotated with completion state.
export function requirementLadder(requirements, completions) {
  const done = completedIds(completions)
  return [...(requirements || [])]
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map(r => ({ ...r, completed: done.has(r.id) }))
}

export function allRequiredComplete(requirements, completions) {
  const done = completedIds(completions)
  return (requirements || []).filter(r => r.required !== false).every(r => done.has(r.id))
}

// The next incomplete step (required or not), or null when the ladder is done.
export function nextRequirement(requirements, completions) {
  return requirementLadder(requirements, completions).find(r => !r.completed) || null
}

// Can this status be written for this user+event? `confirmed` (and anything
// past it) is gated; everything else is always allowed.
const PAST_CONFIRMED = new Set(['confirmed', 'attended'])
export function canSetStatus(status, requirements, completions) {
  if (!PAST_CONFIRMED.has(status)) return true
  return allRequiredComplete(requirements, completions)
}

// Overdue / due-soon required steps for the attention feed. `now` injectable for tests.
export function requirementsDue(requirements, completions, { now = Date.now(), withinDays = 7 } = {}) {
  const done = completedIds(completions)
  const horizon = now + withinDays * 86400000
  return (requirements || [])
    .filter(r => r.required !== false && !done.has(r.id) && r.dueAt)
    .map(r => ({ ...r, dueMs: new Date(r.dueAt).getTime() }))
    .filter(r => r.dueMs <= horizon)
    .map(r => ({ ...r, overdue: r.dueMs < now, daysUntil: Math.ceil((r.dueMs - now) / 86400000) }))
    .sort((a, b) => a.dueMs - b.dueMs)
}
