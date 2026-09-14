// Shared staleness + cost-control primitives for every feed-ingestion / batched
// AI-extraction path in the app (timelineFinder, Recruiting Events ingestion +
// attribute extraction, paste-import). Lifted from lib/timelineFinder.js so the
// pattern lives once:
//
//   hashText      — FNV-1a content hash: "did this record's text change since last run?"
//   splitFresh    — partition candidates into fresh (needs work) vs already-scanned,
//                   seeding scannedKeys with the unchanged ones so the caller can
//                   spread it over its old cache without losing them
//   runChunked    — chunked Promise.allSettled; only a FULFILLED chunk's keys are
//                   marked scanned, so a failed chunk retries next run instead of
//                   silently going stale
//
// Pure, no I/O — safe to import from api/ (service-role handlers) and src/ alike.

export function hashText(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}

// candidates: [{ key, hash, ... }] · skipHashes: { [key]: hash } from the last run
export function splitFresh(candidates, skipHashes = {}) {
  const fresh = []
  const scannedKeys = {}
  for (const c of candidates) {
    if (skipHashes[c.key] === c.hash) scannedKeys[c.key] = c.hash
    else fresh.push(c)
  }
  return { fresh, scannedKeys }
}

export function chunk(items, size) {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// fn(chunk) → array of results for that chunk. Returns the flattened results of
// every fulfilled chunk, the { key: hash } map of every candidate in a fulfilled
// chunk (merge into `scannedKeys` from splitFresh), and one message per failure.
export async function runChunked(items, size, fn) {
  const chunks = chunk(items, size)
  const settled = await Promise.allSettled(chunks.map(fn))
  const results = []
  const scannedKeys = {}
  const errors = []
  settled.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      results.push(...(r.value || []))
      for (const c of chunks[idx]) if (c.key != null) scannedKeys[c.key] = c.hash
    } else {
      errors.push(r.reason?.message || 'Batch failed')
    }
  })
  return { results, scannedKeys, errors, chunkCount: chunks.length }
}

export function partialErrorMessage(errors, chunkCount, what = 'batch') {
  if (!errors.length) return null
  return `${errors.length}/${chunkCount} ${what}(es) failed (will retry next run): ${errors[0]}`
}
