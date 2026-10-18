// Calendar-invite (.ics) parsing for the serverless Gmail scan (v1.3 spec 12). Ported from
// scripts/email-pipeline.js's extractCalendarInvite()/parseIcsDate(), with one fix: the Apps
// Script reads TZID times as script-local, which happened to be right there; on Vercel the
// process runs in UTC, so TZID wall-clock times are converted through Intl instead.
// Pure functions, no Gmail or network access; the caller finds the part and fetches it.

// RFC 5545 §3.1: a line starting with a space or tab continues the previous one.
export function unfoldIcs(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

// Google and Outlook invites put a VTIMEZONE block before the VEVENT, and its DAYLIGHT/
// STANDARD rules carry their own DTSTART (e.g. 19700308T020000). Reading the first DTSTART in
// the file made events start in 1970. Only ever read fields from the VEVENT.
export function veventBlock(text) {
  const m = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/i)
  return m ? m[0] : null
}

// "NAME:value" or "NAME;TZID=America/New_York;VALUE=DATE-TIME:value" → { value, params }.
export function icsField(text, name) {
  const m = text.match(new RegExp(`^${name}((?:;[^:\\n]*)?):(.*)$`, 'im'))
  if (!m) return null
  const params = {}
  for (const p of m[1].split(';').filter(Boolean)) {
    const i = p.indexOf('=')
    if (i > 0) params[p.slice(0, i).toUpperCase()] = p.slice(i + 1).replace(/^"|"$/g, '')
  }
  return { value: m[2].trim(), params }
}

function unescapeText(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')
}

// Outlook/Exchange invites name zones the Windows way. The US ones cover this app's users;
// anything else unknown falls back to floating.
const WINDOWS_ZONES = {
  'Eastern Standard Time': 'America/New_York',
  'Central Standard Time': 'America/Chicago',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Alaskan Standard Time': 'America/Anchorage',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'GMT Standard Time': 'Europe/London',
  'UTC': 'UTC',
}

export function ianaZone(tzid) {
  if (!tzid) return null
  const name = WINDOWS_ZONES[tzid] || tzid.replace(/^\//, '')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name })
    return name
  } catch {
    return null
  }
}

// Milliseconds the zone is ahead of UTC at instant t.
function zoneOffsetMs(t, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(t)).map(p => [p.type, p.value]))
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - Math.floor(t / 1000) * 1000
}

// Wall-clock time in `timeZone` → the UTC instant. Second pass handles a DST edge.
export function zonedToUtc(y, mo, d, h, mi, s, timeZone) {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  let t = wall - zoneOffsetMs(wall, timeZone)
  const again = wall - zoneOffsetMs(t, timeZone)
  if (again !== t) t = again
  return new Date(t)
}

// → { date, allDay, floating } or null.
//   20261021T180000Z            UTC
//   20261021T140000 + TZID      that zone's wall clock
//   20261021T140000 (no TZID)   floating: read as UTC and flagged
//   20261021 / VALUE=DATE       all-day (midnight UTC of that date)
export function parseIcsDate(value, params = {}) {
  if (!value) return null
  const day = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (day) return { date: new Date(Date.UTC(+day[1], +day[2] - 1, +day[3])), allDay: true, floating: false }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, isUtc] = m
  if (isUtc) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false, floating: false }
  const zone = ianaZone(params.TZID)
  if (zone) return { date: zonedToUtc(+y, +mo, +d, +h, +mi, +s, zone), allDay: false, floating: false }
  return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), allDay: false, floating: true }
}

// Raw .ics text → { start, end, allDay, floating, timeZone, summary, location, description }
// or null when there's no parseable VEVENT start.
export function parseInvite(text) {
  const vevent = veventBlock(unfoldIcs(text))
  if (!vevent) return null
  const startField = icsField(vevent, 'DTSTART')
  const start = startField && parseIcsDate(startField.value, startField.params)
  if (!start) return null
  const endField = icsField(vevent, 'DTEND')
  const end = endField && parseIcsDate(endField.value, endField.params)
  const text_ = name => {
    const f = icsField(vevent, name)
    return f ? unescapeText(f.value) : null
  }
  return {
    start: start.date,
    end: end ? end.date : null,
    allDay: start.allDay,
    floating: start.floating,
    timeZone: ianaZone(startField.params.TZID),
    summary: text_('SUMMARY'),
    location: text_('LOCATION'),
    description: text_('DESCRIPTION'),
  }
}

// Walks a Gmail API message payload for the invite: a text/calendar (or application/ics)
// part, or any *.ics attachment. Google/Outlook usually inline it as body.data; otherwise
// only body.attachmentId is set and the caller fetches it. Prefers a part with inline data.
export function findCalendarPart(payload) {
  const found = []
  const walk = part => {
    if (!part) return
    const type = (part.mimeType || '').toLowerCase()
    if (type === 'text/calendar' || type === 'application/ics' || /\.ics$/i.test(part.filename || '')) {
      if (part.body?.data || part.body?.attachmentId) found.push({ data: part.body.data || null, attachmentId: part.body.attachmentId || null })
    }
    for (const p of part.parts || []) walk(p)
  }
  walk(payload)
  return found.find(p => p.data) || found[0] || null
}
