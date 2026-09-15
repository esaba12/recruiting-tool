// Path allowlist for the /google-calendar proxy — an explicit set, not a wildcard.
// Widened for Recruiting Events (dedicated "Recruiting" calendar): a non-primary
// calendar id in the events path, calendarList to find the app-created calendar,
// calendars (POST only) to create it, and freeBusy for the conflict engine.
// Runs BEFORE the refresh-token lookup in api/google-calendar.js.
const CAL_ID = '[A-Za-z0-9._%@+-]{1,128}'   // "primary" or "<hash>@group.calendar.google.com" (URL-encoded @ allowed)
const EVENT_ID = '[A-Za-z0-9_-]{1,1024}'    // singleEvents ids look like "<base>_20260914T140000Z"

const RULES = [
  { re: new RegExp(`^calendar/v3/calendars/${CAL_ID}/events$`), methods: ['GET', 'POST'] },
  { re: new RegExp(`^calendar/v3/calendars/${CAL_ID}/events/${EVENT_ID}$`), methods: ['GET', 'PATCH', 'PUT', 'DELETE'] },
  { re: /^calendar\/v3\/users\/me\/calendarList$/, methods: ['GET'] },
  { re: /^calendar\/v3\/calendars$/, methods: ['POST'] },
  { re: /^calendar\/v3\/freeBusy$/, methods: ['POST'] },
]

export function isAllowedCalendarPath(path, method = 'GET') {
  const p = String(path || '').replace(/\/+$/, '')
  if (p.includes('..') || p.includes('//')) return false
  const m = String(method || 'GET').toUpperCase()
  return RULES.some(r => r.re.test(p) && r.methods.includes(m))
}
