import { authHeader } from './lib/supabaseClient.js'
import { getUserSetting, setUserSetting } from './db.js'

export const CALENDAR_SLOTS = { personal: 'Personal', school: 'School' }
export const RECRUITING_CALENDAR_SUMMARY = 'Recruiting'

// Any path under calendar/v3/ — the server allowlist (api/_lib/calendarAllowlist.js)
// decides what's actually reachable. `slot` picks which connected Google account.
async function gcalRaw(fullPath, { method = 'GET', body, query, slot = 'personal' } = {}) {
  const qs = new URLSearchParams({ ...(query || {}), slot })
  const res = await fetch(`/google-calendar/calendar/v3/${fullPath}?${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    const err = new Error(e.error?.message || `Calendar API ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.status === 204 ? null : res.json() // DELETE returns 204 with no body
}

// Calendar-scoped helper: `calendarId` defaults to the account's primary calendar
// (the original single-calendar behaviour); Recruiting Events passes the id of
// the app-created "Recruiting" calendar instead — never primary.
async function gcalFetch(path, { calendarId = 'primary', ...opts } = {}) {
  return gcalRaw(`calendars/${encodeURIComponent(calendarId)}/${path}`, opts)
}

function normalizeEvent(item, slot, calendarId = 'primary') {
  const allDay = !item.start?.dateTime
  return {
    id: item.id,
    slot,
    calendarId,
    title: item.summary || '(untitled)',
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    allDay,
    location: item.location || null,
    description: item.description || null,
    htmlLink: item.htmlLink || null,
    // With singleEvents=true each occurrence of a series is its own item; this is the
    // series id it belongs to (null for one-offs). Editing/deleting `id` targets only
    // that occurrence — class schedules are recurring, so callers must never PATCH
    // `recurringEventId` when they mean one instance.
    recurringEventId: item.recurringEventId || null,
    status: item.status || 'confirmed',
    // extendedProperties.private is where this app tags what it pushed (see lib/eventCalendarSync.js).
    meta: item.extendedProperties?.private || null,
    updated: item.updated || null,
  }
}

async function listEventsForSlot({ timeMin, timeMax, slot, calendarId = 'primary' }) {
  let items = []
  let pageToken
  do {
    const data = await gcalFetch('events', {
      slot, calendarId,
      query: {
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      },
    })
    items = items.concat(data.items || [])
    pageToken = data.nextPageToken
  } while (pageToken)
  return items.map(item => normalizeEvent(item, slot, calendarId))
}

// Merges both slots' events into one list, each tagged with which calendar it came from.
// A slot that isn't connected (or whose token has expired) fails on its own without
// blocking the other — same fail-soft posture as everywhere else Calendar is read from.
// Pass `slots` to scope to just one (e.g. a single-slot fetch elsewhere) — defaults to both.
export async function listEvents({ timeMin, timeMax, slots = Object.keys(CALENDAR_SLOTS), calendarId = 'primary' }) {
  const results = await Promise.allSettled(slots.map(slot => listEventsForSlot({ timeMin, timeMax, slot, calendarId })))
  const errors = []
  const events = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') events.push(...r.value)
    else errors.push({ slot: slots[i], message: r.reason?.message || 'Failed to load' })
  })
  // Only surface an error if EVERY requested slot failed — one dead/unconnected slot
  // shouldn't hide events that loaded fine from the other.
  if (events.length === 0 && errors.length === slots.length && errors.length > 0) {
    throw new Error(errors.map(e => `${CALENDAR_SLOTS[e.slot] || e.slot}: ${e.message}`).join(' · '))
  }
  return events.sort((a, b) => new Date(a.start) - new Date(b.start))
}

export function addOneHour(time) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m)
  d.setHours(d.getHours() + 1)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Two ways to say when: the original (date + 'HH:MM' local wall-clock, used by the
// modals) or `start`/`end` as ISO instants (used by Recruiting Events, whose rows are
// timestamptz). Extras (`extendedProperties`, `reminders`, `colorId`) pass straight through.
export function eventBody({ title, date, startTime, endTime, start, end, allDay, location, description, extendedProperties, reminders, colorId }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  let startObj, endObj
  if (start || end) {
    startObj = allDay ? { date: (start || '').slice(0, 10) } : { dateTime: start, timeZone }
    endObj = allDay ? { date: (end || start || '').slice(0, 10) } : { dateTime: end || start, timeZone }
  } else {
    startObj = startTime ? { dateTime: `${date}T${startTime}:00`, timeZone } : { date }
    endObj = endTime ? { dateTime: `${date}T${endTime}:00`, timeZone } : { date }
  }
  return {
    summary: title || 'Untitled event',
    location: location || undefined,
    description: description || undefined,
    start: startObj, end: endObj,
    extendedProperties: extendedProperties || undefined,
    reminders: reminders || undefined,
    colorId: colorId || undefined,
  }
}

export async function createEvent({ slot = 'personal', calendarId = 'primary', ...fields }) {
  return normalizeEvent(await gcalFetch('events', { method: 'POST', body: eventBody(fields), slot, calendarId }), slot, calendarId)
}

export async function getEvent(eventId, { slot = 'personal', calendarId = 'primary' } = {}) {
  return normalizeEvent(await gcalFetch(`events/${encodeURIComponent(eventId)}`, { slot, calendarId }), slot, calendarId)
}

// PATCH semantics: only the fields in `patch` change. `eventId` must be the id of the
// thing you mean — under singleEvents=true that's a per-occurrence id for recurring
// series, and patching it edits that one instance (Google materializes an exception),
// never the whole series. To edit a series, pass its recurringEventId explicitly.
export async function updateEvent(eventId, patch, { slot = 'personal', calendarId = 'primary' } = {}) {
  const body = patch.start || patch.end || patch.date ? eventBody(patch) : patch
  // eventBody() fills every key; strip the ones the caller didn't ask to change so
  // PATCH doesn't clobber them with undefined→omitted (fine) or defaults (not fine).
  if (body !== patch) {
    if (!('title' in patch)) delete body.summary
    if (!('location' in patch)) delete body.location
    if (!('description' in patch)) delete body.description
  }
  return normalizeEvent(await gcalFetch(`events/${encodeURIComponent(eventId)}`, { method: 'PATCH', body, slot, calendarId }), slot, calendarId)
}

// Note: with singleEvents=true, list() returns per-occurrence ids for recurring
// events, so deleting one of those ids removes only that occurrence, not the series.
export async function deleteEvent(eventId, slot = 'personal', calendarId = 'primary') {
  return gcalFetch(`events/${encodeURIComponent(eventId)}`, { method: 'DELETE', slot, calendarId })
}

// ── Calendars (needs the calendar.app.created scope — see api/_lib/googleOAuth.js) ──

export async function listCalendars(slot = 'personal') {
  const data = await gcalRaw('users/me/calendarList', { slot })
  return (data.items || []).map(c => ({ id: c.id, summary: c.summary, primary: !!c.primary, timeZone: c.timeZone || null, backgroundColor: c.backgroundColor || null }))
}

export async function createCalendar(slot = 'personal', { summary, description, timeZone } = {}) {
  const body = { summary, description: description || undefined, timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone }
  const c = await gcalRaw('calendars', { method: 'POST', body, slot })
  return { id: c.id, summary: c.summary, timeZone: c.timeZone || null }
}

const RECRUITING_CAL_KEY = slot => `recruiting_calendar_id:${slot}`

// The dedicated "Recruiting" calendar for a slot: cached id in user_settings →
// verified against calendarList (the app.created scope only lists calendars this
// app made, so a hit is ours) → created if missing. Never returns 'primary'.
export async function ensureRecruitingCalendar(slot = 'personal') {
  const calendars = await listCalendars(slot)
  const cached = await getUserSetting(RECRUITING_CAL_KEY(slot))
  const byId = cached && calendars.find(c => c.id === cached)
  if (byId) return byId.id
  const bySummary = calendars.find(c => c.summary === RECRUITING_CALENDAR_SUMMARY && !c.primary)
  if (bySummary) { await setUserSetting(RECRUITING_CAL_KEY(slot), bySummary.id); return bySummary.id }
  const created = await createCalendar(slot, { summary: RECRUITING_CALENDAR_SUMMARY, description: 'Career fairs, info sessions, coffee chats and their registration deadlines — pushed by Recruiting OS.' })
  await setUserSetting(RECRUITING_CAL_KEY(slot), created.id)
  return created.id
}

export async function getCachedRecruitingCalendarId(slot = 'personal') {
  return getUserSetting(RECRUITING_CAL_KEY(slot))
}

// Free/busy for a set of calendars on one slot — the conflict engine's cheap path
// when it only needs blocks, not titles. Returns [{ start, end }] per calendarId.
export async function freeBusy({ slot = 'personal', timeMin, timeMax, calendarIds = ['primary'] }) {
  const data = await gcalRaw('freeBusy', { method: 'POST', slot, body: { timeMin, timeMax, items: calendarIds.map(id => ({ id })) } })
  return Object.fromEntries(Object.entries(data.calendars || {}).map(([id, v]) => [id, (v.busy || []).map(b => ({ start: b.start, end: b.end }))]))
}
