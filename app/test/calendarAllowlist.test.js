import { describe, it, expect } from 'vitest'
import { isAllowedCalendarPath } from '../api/_lib/calendarAllowlist.js'

const ok = (p, m) => expect(isAllowedCalendarPath(p, m), `${m} ${p}`).toBe(true)
const no = (p, m) => expect(isAllowedCalendarPath(p, m), `${m} ${p}`).toBe(false)

describe('google-calendar proxy allowlist', () => {
  it('allows the existing primary-calendar event paths', () => {
    ok('calendar/v3/calendars/primary/events', 'GET')
    ok('calendar/v3/calendars/primary/events', 'POST')
    ok('calendar/v3/calendars/primary/events/abc123', 'DELETE')
    ok('calendar/v3/calendars/primary/events/abc123_20260914T140000Z', 'PATCH')
  })
  it('allows a non-primary (app-created) calendar id', () => {
    ok('calendar/v3/calendars/c_7f3a1b@group.calendar.google.com/events', 'POST')
    ok('calendar/v3/calendars/c_7f3a1b%40group.calendar.google.com/events/evt-1', 'PATCH')
  })
  it('allows calendarList GET, calendars POST, freeBusy POST — and nothing else on them', () => {
    ok('calendar/v3/users/me/calendarList', 'GET')
    no('calendar/v3/users/me/calendarList', 'DELETE')
    no('calendar/v3/users/me/calendarList/primary', 'PATCH')
    ok('calendar/v3/calendars', 'POST')
    no('calendar/v3/calendars', 'GET')
    no('calendar/v3/calendars/primary', 'DELETE')       // never delete a calendar
    ok('calendar/v3/freeBusy', 'POST')
    no('calendar/v3/freeBusy', 'GET')
  })
  it('rejects everything else', () => {
    no('calendar/v3/users/me/settings', 'GET')
    no('calendar/v3/colors', 'GET')
    no('calendar/v3/calendars/primary/acl', 'GET')
    no('calendar/v3/calendars/primary/events/x/instances', 'GET')
    no('oauth2/v3/userinfo', 'GET')
    no('calendar/v3/calendars/../../drive/v3/files', 'GET')
    no('calendar/v3/calendars//events', 'GET')
    no('', 'GET')
    ok('calendar/v3/calendars/primary/events/', 'GET')   // trailing slash normalizes to the list path
  })
})
