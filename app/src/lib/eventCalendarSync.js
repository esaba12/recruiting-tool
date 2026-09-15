// Recruiting Events ↔ Google Calendar sync. Everything lands on the dedicated
// "Recruiting" calendar (googleCalendar.js's ensureRecruitingCalendar), never
// primary. Per user event we push:
//   • the event itself                        → user_events.calendar_event_id
//   • one reminder per incomplete required
//     requirement with a due_at               → calendar_reminder_ids["req:<requirementId>"]
//   • one reminder for followup_due_at        → calendar_reminder_ids["followup"]
// Every pushed item carries extendedProperties.private.recruitingOs so a later
// reconcile can recognize ours. Deleting in-app deletes in Google; a Google-side
// delete only nulls the id (row kept) — see reconcile().
import { createEvent, updateEvent, deleteEvent, listEvents } from '../googleCalendar.js'
import { REQUIREMENT_LABEL } from './eventRequirements.js'
import { hashText } from './ingest/hashGate.js'

const REMINDER_MIN = 30
const DAY = 86400000

function reqKey(r) { return `req:${r.id}` }

export function buildEventBody(event, { requirements = [], completions = [] } = {}) {
  const done = new Set(completions.map(c => c.requirementId))
  const ladder = [...requirements].sort((a, b) => a.stepOrder - b.stepOrder)
    .map(r => `${done.has(r.id) ? '☑' : '☐'} ${r.label || REQUIREMENT_LABEL[r.kind] || r.kind}${r.dueAt ? ` (by ${r.dueAt.slice(0, 10)})` : ''}`)
  const lines = [
    event.description ? event.description.slice(0, 1500) : null,
    event.registrationUrl ? `Register: ${event.registrationUrl}` : null,
    ladder.length ? `Steps:\n${ladder.join('\n')}` : null,
    event.url ? `Source: ${event.url}` : null,
    '— pushed by Recruiting OS',
  ].filter(Boolean)
  const end = event.endsAt || new Date(Date.parse(event.startsAt) + 3600000).toISOString()
  return {
    title: event.title,
    location: event.isVirtual && !event.location ? 'Virtual' : (event.location || undefined),
    description: lines.join('\n\n'),
    start: event.startsAt, end, allDay: !!event.allDay,
    extendedProperties: { private: { recruitingOs: 'event', eventId: event.id } },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 60 }, { method: 'popup', minutes: 24 * 60 }] },
  }
}

export function buildReminderBody(event, { kind, requirement, dueAt }) {
  const dueMs = Date.parse(dueAt)
  const label = kind === 'followup'
    ? `Follow up: ${event.title}`
    : `Due: ${requirement.label || REQUIREMENT_LABEL[requirement.kind] || requirement.kind} — ${event.title}`
  return {
    title: `⏰ ${label}`,
    description: [
      kind === 'followup' ? `Post-event follow-ups for ${event.title}.` : `Signup step for ${event.title} (${event.startsAt.slice(0, 10)}).`,
      requirement?.url ? requirement.url : null,
      '— pushed by Recruiting OS',
    ].filter(Boolean).join('\n\n'),
    start: new Date(dueMs - REMINDER_MIN * 60000).toISOString(), end: new Date(dueMs).toISOString(), allDay: false,
    extendedProperties: { private: { recruitingOs: 'reminder', eventId: event.id, reminderKey: kind === 'followup' ? 'followup' : reqKey(requirement) } },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 0 }, { method: 'popup', minutes: 24 * 60 }] },
  }
}

// Which reminders SHOULD exist right now for this user+event.
export function desiredReminders(event, { userEvent, completions = [], now = Date.now() } = {}) {
  const done = new Set(completions.map(c => c.requirementId))
  const out = []
  for (const r of event.requirements || []) {
    if (r.required === false || done.has(r.id) || !r.dueAt) continue
    if (Date.parse(r.dueAt) < now) continue
    out.push({ key: reqKey(r), kind: 'requirement', requirement: r, dueAt: r.dueAt })
  }
  if (userEvent?.followupDueAt && !userEvent.followupDoneAt && Date.parse(userEvent.followupDueAt) > now - DAY) {
    out.push({ key: 'followup', kind: 'followup', dueAt: userEvent.followupDueAt })
  }
  return out
}

function isGone(e) { return e?.status === 404 || e?.status === 410 }

// Hash of everything Google would see — pushEvent is a no-op when it matches the
// stored calendar_sync_hash, so daily feed re-verification doesn't cause PATCH churn.
export function syncHash(event, { userEvent, completions = [], now = Date.now() } = {}) {
  return hashText(JSON.stringify([buildEventBody(event, { requirements: event.requirements, completions }), desiredReminders(event, { userEvent, completions, now }).map(w => [w.key, w.dueAt])]))
}

export function needsPush(event, { userEvent, completions = [], now = Date.now() } = {}) {
  if (!userEvent?.calendarEventId) return true
  return userEvent.calendarSyncHash !== syncHash(event, { userEvent, completions, now })
}

// Create or patch the main event + reconcile reminders. Returns the fields to persist
// on user_events. Idempotent: safe to call again after the event's text/time changes.
export async function pushEvent({ event, userEvent, completions = [], slot, calendarId, now = Date.now() }) {
  const opts = { slot, calendarId }
  const body = buildEventBody(event, { requirements: event.requirements, completions })
  let calendarEventId = userEvent?.calendarEventId || null
  if (calendarEventId) {
    try { await updateEvent(calendarEventId, body, opts) }
    catch (e) { if (isGone(e)) calendarEventId = null; else throw e }
  }
  if (!calendarEventId) calendarEventId = (await createEvent({ ...body, ...opts })).id

  const existing = { ...(userEvent?.calendarReminderIds || {}) }
  const wanted = desiredReminders(event, { userEvent, completions, now })
  const wantedKeys = new Set(wanted.map(w => w.key))
  // Remove reminders that no longer apply (step completed, date passed, follow-up done).
  for (const key of Object.keys(existing)) {
    if (wantedKeys.has(key)) continue
    try { await deleteEvent(existing[key], slot, calendarId) } catch (e) { if (!isGone(e)) throw e }
    delete existing[key]
  }
  for (const w of wanted) {
    const rb = buildReminderBody(event, w)
    if (existing[w.key]) {
      try { await updateEvent(existing[w.key], rb, opts); continue }
      catch (e) { if (!isGone(e)) throw e; delete existing[w.key] }
    }
    existing[w.key] = (await createEvent({ ...rb, ...opts })).id
  }
  return { calendarSlot: slot, calendarEventId, calendarReminderIds: existing, calendarSyncedAt: new Date(now).toISOString(), calendarSyncHash: syncHash(event, { userEvent, completions, now }) }
}

// In-app removal → Google removal. Missing-in-Google is not an error.
export async function unpushEvent({ userEvent, slot, calendarId }) {
  const ids = [userEvent?.calendarEventId, ...Object.values(userEvent?.calendarReminderIds || {})].filter(Boolean)
  for (const id of ids) {
    try { await deleteEvent(id, slot, calendarId) } catch (e) { if (!isGone(e)) throw e }
  }
  return { calendarEventId: null, calendarReminderIds: {}, calendarSyncedAt: null, calendarSyncHash: null }
}

// Google-side deletes: list what's actually on the Recruiting calendar and null any
// stored id that's no longer there. Never destroys our row. Returns [{ eventId, patch }].
export async function reconcile({ userEvents, slot, calendarId, now = Date.now() }) {
  const synced = userEvents.filter(u => u.calendarSlot === slot && (u.calendarEventId || Object.keys(u.calendarReminderIds || {}).length))
  if (!synced.length) return []
  const timeMin = new Date(now - 60 * DAY).toISOString()
  const timeMax = new Date(now + 400 * DAY).toISOString()
  const live = await listEvents({ timeMin, timeMax, slots: [slot], calendarId })
  const present = new Set(live.filter(e => e.status !== 'cancelled').map(e => e.id))
  const patches = []
  for (const u of synced) {
    const patch = {}
    if (u.calendarEventId && !present.has(u.calendarEventId)) patch.calendarEventId = null
    const reminders = { ...(u.calendarReminderIds || {}) }
    let changed = false
    for (const [k, id] of Object.entries(reminders)) if (!present.has(id)) { delete reminders[k]; changed = true }
    if (changed) patch.calendarReminderIds = reminders
    if (Object.keys(patch).length) patches.push({ eventId: u.eventId, patch })
  }
  return patches
}

// Should this event be on the calendar automatically? (relevance ≥ high, in the future,
// not dismissed/skipped) — the brief's "push events at relevance >= high".
export function shouldAutoPush(event, { tier, userEvent, now = Date.now() } = {}) {
  if (tier !== 'high') return false
  if (Date.parse(event.startsAt) < now) return false
  if (['skipped'].includes(userEvent?.status)) return false
  return true
}
