// IANA-timezone arithmetic without a tz library — Intl.DateTimeFormat gives us
// the wall-clock parts of a UTC instant in any zone, and from that the offset.
// Shared by feed normalization (Localist emits local wall-clock times) and the
// conflict engine (class blocks vs. event windows across zones).

const partsFmtCache = new Map()
function partsFormatter(tz) {
  if (!partsFmtCache.has(tz)) {
    partsFmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
  }
  return partsFmtCache.get(tz)
}

export function isValidTimeZone(tz) {
  try { partsFormatter(tz); return true } catch { return false }
}

// Wall-clock parts of `utcMs` as seen in `tz`.
export function wallClock(utcMs, tz) {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(new Date(utcMs)).map(x => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second }
}

// Offset (ms) of `tz` from UTC at the instant `utcMs` (positive east of UTC).
export function tzOffsetMs(utcMs, tz) {
  const w = wallClock(utcMs, tz)
  return Date.UTC(w.y, w.m - 1, w.d, w.hh, w.mm, w.ss) - utcMs
}

// Local wall-clock → UTC ms. Two-pass to land on the right side of a DST change.
export function localToUtcMs({ y, m, d, hh = 0, mm = 0, ss = 0 }, tz) {
  const naive = Date.UTC(y, m - 1, d, hh, mm, ss)
  const off1 = tzOffsetMs(naive, tz)
  let utc = naive - off1
  const off2 = tzOffsetMs(utc, tz)
  if (off2 !== off1) utc = naive - off2
  return utc
}

export function localToIso(parts, tz) {
  return new Date(localToUtcMs(parts, tz)).toISOString()
}

// "YYYYMMDDTHHMMSS" (Localist/ICS compact) or "YYYY-MM-DD[THH:MM[:SS]]" → parts.
export function parseCompactLocal(s) {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})(?:T(\d{2}):?(\d{2}):?(\d{2})?)?/.exec(s || '')
  if (!m) return null
  return { y: +m[1], m: +m[2], d: +m[3], hh: m[4] ? +m[4] : 0, mm: m[5] ? +m[5] : 0, ss: m[6] ? +m[6] : 0 }
}
