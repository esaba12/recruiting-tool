// Feed freshness gate — the defense against a source that answers a 2026 query
// with 2023 data (a cached Localist endpoint, a years-old public mirror). Runs on
// every pull, before anything is written. A degraded verdict marks the source in
// ingest_sources and skips the write entirely; nothing stale reaches the pool.

const DAY = 86400000

// items: [{ startsAt }] · termWindows: [{ name, start, end }] (YYYY-MM-DD, inclusive)
// Returns { ok, reason, stats } — ok=false means DEGRADED.
export function assessFreshness(items, termWindows = [], { now = Date.now(), pastGraceDays = 45, futureHorizonDays = 400 } = {}) {
  const total = items.length
  if (!total) return { ok: true, reason: null, stats: { total: 0, past: 0, future: 0, inTerm: 0 } }

  let past = 0, future = 0, inTerm = 0, undated = 0
  for (const it of items) {
    const t = new Date(it.startsAt).getTime()
    if (Number.isNaN(t)) { undated++; continue }
    if (t < now - pastGraceDays * DAY) past++
    else if (t > now + futureHorizonDays * DAY) future++
    if (termWindows.some(w => inWindow(t, w))) inTerm++
  }
  const dated = total - undated
  const stats = { total, past, future, inTerm, undated }

  if (!dated) return { ok: false, reason: 'Feed returned no parseable dates', stats }
  if (past / dated > 0.5) {
    const sampleYear = new Date(items.find(i => !Number.isNaN(new Date(i.startsAt).getTime())).startsAt).getUTCFullYear()
    return { ok: false, reason: `Feed returned mostly past-dated events (${past}/${dated} older than ${pastGraceDays}d; e.g. ${sampleYear})`, stats }
  }
  if (future / dated > 0.5) return { ok: false, reason: `Feed returned mostly far-future events (${future}/${dated} beyond ${futureHorizonDays}d)`, stats }
  if (termWindows.length && inTerm === 0) {
    return { ok: false, reason: 'No event falls inside any configured academic term window', stats }
  }
  return { ok: true, reason: null, stats }
}

function inWindow(t, w) {
  const start = Date.parse(`${w.start}T00:00:00Z`)
  const end = Date.parse(`${w.end}T23:59:59Z`)
  return !Number.isNaN(start) && !Number.isNaN(end) && t >= start && t <= end
}

// Per-event staleness for the UI + scorer: verified more than `days` ago.
export function isStale(sourceLastVerifiedAt, { now = Date.now(), days = 14 } = {}) {
  const t = new Date(sourceLastVerifiedAt).getTime()
  return Number.isNaN(t) || now - t > days * DAY
}
