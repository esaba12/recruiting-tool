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
