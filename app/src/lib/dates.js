// Date-only helpers. A bare 'YYYY-MM-DD' passed to new Date() is parsed as UTC midnight,
// which is the previous evening in US time zones — so every date-only field rendered a
// day early. Date-only strings are calendar days, not instants: parse them as LOCAL
// midnight. Anything else (timestamps with a time/offset, Dates, numbers) is a real
// instant and passes through new Date() untouched.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseDay(d) {
  if (typeof d === 'string') {
    const m = DATE_ONLY_RE.exec(d)
    if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  }
  return new Date(d)
}

function localMidnight(d) {
  const x = parseDay(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate())
}

// Whole calendar days from a to b (local midnights, so DST can't skew it).
function calendarDays(a, b) {
  const A = localMidnight(a), B = localMidnight(b)
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000)
}

export function daysSince(d, now = Date.now()) {
  if (!d) return null
  return calendarDays(d, now)
}

export function daysUntil(d, now = Date.now()) {
  if (!d) return null
  return calendarDays(now, d)
}

export function daysBetween(a, b) {
  if (!a || !b) return null
  return calendarDays(a, b)
}

export function formatDay(d) {
  if (!d) return '—'
  return parseDay(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// 'YYYY-MM-DD' for the user's LOCAL calendar day. toISOString() is UTC, which flips to
// tomorrow after ~8pm Eastern.
export function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayLocal() { return localDateStr(new Date()) }

export function addDaysLocal(n, from = new Date()) {
  return localDateStr(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n))
}

// An interview instant ↔ the panel's date and time inputs, in the browser's zone (v1.4 spec 02).
// No time typed means the time isn't known: it's stored at local noon, which keeps the day
// right in any US zone, and shown as the date alone.
export function instantToInputs(iso, timeKnown) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  return { date: localDateStr(d), time: timeKnown ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '' }
}

export function inputsToInstant(date, time) {
  if (!date) return { at: null, timeKnown: false }
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time ? time.split(':').map(Number) : [12, 0]
  return { at: new Date(y, m - 1, d, h, mi).toISOString(), timeKnown: !!time }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = n => String(n).padStart(2, '0')

function ymd(y, m, d) {
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

// A date as people type it in a sheet ("2026-09-03", "9/3/26", "Sep 3", "15 Oct 2024") →
// 'YYYY-MM-DD' (a local calendar day) or null. For things that already happened: a date after
// `today` is rejected, and a yearless date that would land in the future means last year.
export function parseLooseDate(v, today = todayLocal()) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const ty = Number(today.slice(0, 4))
  let y = null, m = null, d = null
  let r
  if ((r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [r[1], r[2], r[3]].map(Number)
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    m = Number(r[1]); d = Number(r[2])
    if (r[3]) y = r[3].length === 2 ? 2000 + Number(r[3]) : Number(r[3])
  } else if ((r = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/))) {
    m = MONTHS.indexOf(r[1].slice(0, 3).toLowerCase()) + 1; d = Number(r[2]); y = r[3] ? Number(r[3]) : null
  } else if ((r = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?(?:,?\s+(\d{4}))?$/))) {
    d = Number(r[1]); m = MONTHS.indexOf(r[2].slice(0, 3).toLowerCase()) + 1; y = r[3] ? Number(r[3]) : null
  } else return null
  if (!m || m < 1) return null
  if (y == null) {
    const guess = ymd(ty, m, d)
    if (!guess) return null
    return guess > today ? ymd(ty - 1, m, d) : guess
  }
  const out = ymd(y, m, d)
  return out && out <= today ? out : null
}

// ── OA deadlines ───────────────────────────────────────────────────────────────────────
// oaDueDate is the day; oaDueAt is the exact instant when the invite stated a time (else null).
// A day with no time counts as due at the end of that day.
export function oaDueMs(app) {
  if (app?.oaDueAt) return new Date(app.oaDueAt).getTime()
  if (!app?.oaDueDate) return null
  const d = parseDay(app.oaDueDate)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

export function oaOverdue(app, now = Date.now()) {
  const t = oaDueMs(app)
  return t !== null && t < now
}

const dueClock = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dueDay = d => parseDay(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

// "Due today, 5:00 PM", "Due tomorrow", "Due Wed, Nov 25, 9:00 AM (4d)", "Was due Thu, Nov 19 (2d ago)".
export function oaDueLabel(app, now = Date.now()) {
  if (!app?.oaDueDate && !app?.oaDueAt) return ''
  const day = app.oaDueAt ? localDateStr(new Date(app.oaDueAt)) : app.oaDueDate
  const d = daysUntil(day, now)
  const time = app.oaDueAt ? `, ${dueClock(app.oaDueAt)}` : ''
  const when = d === 0 ? `today${time}` : d === 1 ? `tomorrow${time}` : d === -1 ? `yesterday${time}` : `${dueDay(day)}${time}`
  const tail = d > 1 ? ` (${d}d)` : d < -1 ? ` (${-d}d ago)` : ''
  return `${oaOverdue(app, now) ? 'Was due' : 'Due'} ${when}${tail}`
}
