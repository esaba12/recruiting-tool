// Interview calendar event when the email has no invite (v1.3 spec 08 item 3), ported from
// scripts/email-pipeline.js createCalendarEvent(). An attached invite already is the calendar
// entry (Google adds it), so this only runs without one. The classifier gives a date, never a
// time, so the event is the Apps Script's 2–3pm placeholder, and says so.
// Two guards the Apps Script lacked: no events for past dates (a new mailbox's first scan
// walks 45 days of mail), and the same-day title check also catches an event the Apps Script
// already made while both pipelines run.
import { decrypt } from './crypto.js'
import { zonedToUtc } from './ics.js'

const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const SYNC_SETTING_KEY = 'recruiting_calendar_sync' // src/lib/useEventCalendarSync.js

export function shouldCreateInterviewEvent(data, { invite, today }) {
  return data?.type === 'INTERVIEW_INVITE' && !invite
    && /^\d{4}-\d{2}-\d{2}$/.test(data.interview_date || '') && data.interview_date >= today
}

export function interviewEventFor(data, { timeZone }) {
  const title = `Interview — ${data.company || 'Unknown company'}${data.role ? ` · ${data.role}` : ''}`
  const description = [
    data.summary,
    'Time is a placeholder: the email gave a date but no time.',
    `Format: ${data.interview_format || 'TBD'}`,
    data.meeting_link ? `Meeting link: ${data.meeting_link}` : '',
    data.next_action ? `Next action: ${data.next_action}` : '',
    data.follow_up_draft ? `\nDraft reply:\n${data.follow_up_draft}` : '',
  ].filter(Boolean).join('\n')
  return {
    summary: title,
    description,
    ...(data.meeting_link ? { location: data.meeting_link } : {}),
    start: { dateTime: `${data.interview_date}T14:00:00`, timeZone },
    end: { dateTime: `${data.interview_date}T15:00:00`, timeZone },
  }
}

function dayWindow(date, timeZone) {
  const [y, m, d] = date.split('-').map(Number)
  const start = zonedToUtc(y, m, d, 0, 0, 0, timeZone)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const end = zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0, timeZone)
  return { timeMin: start.toISOString(), timeMax: end.toISOString() }
}

// → { created: id } | { skipped: 'exists' }. Throws on a Google error.
export async function createInterviewEvent(accessToken, data, { timeZone, fetch = globalThis.fetch }) {
  const event = interviewEventFor(data, { timeZone })
  const headers = { Authorization: `Bearer ${accessToken}` }
  const listUrl = `${CALENDAR_BASE}?${new URLSearchParams({ ...dayWindow(data.interview_date, timeZone), singleEvents: 'true', maxResults: '250' })}`
  const listRes = await fetch(listUrl, { headers })
  if (!listRes.ok) throw new Error(`Calendar list ${listRes.status}`)
  const { items = [] } = await listRes.json()
  if (items.some(e => e.summary === event.summary)) return { skipped: 'exists' }

  const res = await fetch(CALENDAR_BASE, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(event) })
  if (!res.ok) throw new Error(`Calendar insert ${res.status}`)
  return { created: (await res.json()).id }
}

// The refresh token for the calendar this user syncs to (Settings → Recruiting calendar
// slot), else whichever slot is connected. Null when no calendar is connected.
export async function calendarRefreshToken(db, userId) {
  const [{ data: rows }, { data: sync }] = await Promise.all([
    db.from('google_calendar_tokens').select('slot, refresh_token_ciphertext').eq('user_id', userId),
    db.from('user_settings').select('value').eq('user_id', userId).eq('key', SYNC_SETTING_KEY).maybeSingle(),
  ])
  if (!rows?.length) return null
  const preferred = sync?.value?.slot || 'personal'
  const row = rows.find(r => r.slot === preferred) || rows[0]
  try { return decrypt(row.refresh_token_ciphertext) } catch { return null }
}
