import { authHeader } from './lib/supabaseClient.js'

export const CALENDAR_SLOTS = { personal: 'Personal', school: 'School' }

async function gcalFetch(path, { method = 'GET', body, query, slot = 'personal' } = {}) {
  const qs = new URLSearchParams({ ...(query || {}), slot })
  const res = await fetch(`/google-calendar/calendar/v3/calendars/primary/${path}?${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || `Calendar API ${res.status}`)
  }
  return res.status === 204 ? null : res.json() // DELETE returns 204 with no body
}

function normalizeEvent(item, slot) {
  const allDay = !item.start?.dateTime
  return {
    id: item.id,
    slot,
    title: item.summary || '(untitled)',
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    allDay,
    location: item.location || null,
    description: item.description || null,
    htmlLink: item.htmlLink || null,
  }
}

async function listEventsForSlot({ timeMin, timeMax, slot }) {
  let items = []
  let pageToken
  do {
    const data = await gcalFetch('events', {
      slot,
      query: {
        timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
        ...(pageToken ? { pageToken } : {}),
      },
    })
    items = items.concat(data.items || [])
    pageToken = data.nextPageToken
  } while (pageToken)
  return items.map(item => normalizeEvent(item, slot))
}

// Merges both slots' events into one list, each tagged with which calendar it came from.
// A slot that isn't connected (or whose token has expired) fails on its own without
// blocking the other — same fail-soft posture as everywhere else Calendar is read from.
// Pass `slots` to scope to just one (e.g. a single-slot fetch elsewhere) — defaults to both.
export async function listEvents({ timeMin, timeMax, slots = Object.keys(CALENDAR_SLOTS) }) {
  const results = await Promise.allSettled(slots.map(slot => listEventsForSlot({ timeMin, timeMax, slot })))
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

export async function createEvent({ title, date, startTime, endTime, location, description, slot = 'personal' }) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const body = {
    summary: title || 'Untitled event',
    location: location || undefined,
    description: description || undefined,
    start: startTime ? { dateTime: `${date}T${startTime}:00`, timeZone } : { date },
    end:   endTime   ? { dateTime: `${date}T${endTime}:00`,   timeZone } : { date },
  }
  return gcalFetch('events', { method: 'POST', body, slot })
}

// Note: with singleEvents=true, list() returns per-occurrence ids for recurring
// events, so deleting one of those ids removes only that occurrence, not the series.
export async function deleteEvent(eventId, slot = 'personal') {
  return gcalFetch(`events/${encodeURIComponent(eventId)}`, { method: 'DELETE', slot })
}
