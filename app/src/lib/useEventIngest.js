import { useState, useEffect, useRef } from 'react'
import { lsGet, lsSet } from './scopedStorage.js'
import { authHeader } from './supabaseClient.js'
import { todayStr } from './ingest/scheduler.js'

const META_KEY = 'rec_events_ingest_meta'   // { lastCheck, lastResult }

// Hands-off daily pull of the caller's school's event feeds into the shared
// pool. Same daily-gate idiom as useTimelineFinds/DiscoverTab (ranRef +
// lastCheck !== today, `enabled` so demo mode can no-op while still calling the
// hook unconditionally). The server owns cost control (a source is re-pulled at
// most every 12h school-wide), so the first person at a campus to open the app
// each day does the pull and everyone else just reads.
//
// Relay step: when the server reports a source it couldn't fetch (Cloudflare
// bot challenge — events.umich.edu does this to non-browser TLS), this real
// browser session fetches the CORS-open JSON itself and posts it back; the
// server re-validates host + freshness + dedup before anything is written.
async function post(body) {
  const res = await fetch('/api/events-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Ingest failed (${res.status})`)
  return data
}

async function browserFetchFeed(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export default function useEventIngest({ enabled = true, onIngested } = {}) {
  const [meta, setMeta] = useState(() => lsGet(META_KEY) || { lastCheck: null, lastResult: null })
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const ranRef = useRef(false)

  async function run({ force = false } = {}) {
    if (running) return null
    setRunning(true); setError(null)
    try {
      const first = await post({ mode: 'run', force })
      const ran = [...(first.ran || [])]
      for (const r of first.needsRelay || []) {
        try {
          const payload = await browserFetchFeed(r.url)
          const relayed = await post({ mode: 'relay', ref: r.ref, payload })
          ran.push(...(relayed.ran || []))
        } catch (e) {
          ran.push({ ref: r.ref, label: r.label, degraded: `Browser fetch failed: ${e.message}`, inserted: 0, updated: 0, merged: 0 })
        }
      }
      const result = { ...first, ran, at: Date.now() }
      setMeta(prev => { const next = { ...prev, lastCheck: todayStr(), lastResult: result }; lsSet(META_KEY, next); return next })
      if (ran.some(r => r.inserted || r.updated || r.merged)) onIngested?.(result)
      return result
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setRunning(false)
    }
  }

  useEffect(() => {
    if (!enabled) return
    if (ranRef.current) return
    ranRef.current = true
    if (meta.lastCheck !== todayStr()) run({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { meta, running, error, run }
}
