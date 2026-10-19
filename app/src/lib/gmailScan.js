// Gmail connection + "scan now" state shared by the onboarding wizard, Today's getting-started
// card and Settings (v1.4 spec 07). Module-level, so a first scan started in the wizard keeps
// its status when the app takes over after "Go to Today". A finished scan fires
// `rec:data-changed`, which AppInner answers with a quiet refetch, so the rows it found appear.
import { useEffect, useSyncExternalStore } from 'react'
import { listGmailConnections, scanMyGmail } from './googleAuth.js'
import { isDemoMode } from './demoMode.js'

let state = { connections: null, scanning: false, lastScan: null, error: null }
let autoTried = false
const subs = new Set()
const set = patch => { state = { ...state, ...patch }; subs.forEach(f => f()) }
const subscribe = f => { subs.add(f); return () => subs.delete(f) }

export async function loadGmailConnections() {
  try { set({ connections: await listGmailConnections() }) } catch { set({ connections: [] }) }
  return state.connections
}

// → the API's per-mailbox results. Never throws: errors land in `state.error`.
export async function scanGmailNow() {
  if (state.scanning || isDemoMode()) return null
  set({ scanning: true, error: null })
  try {
    const { results } = await scanMyGmail()
    set({ lastScan: { at: Date.now(), results } })
    window.dispatchEvent(new CustomEvent('rec:data-changed'))
    return results
  } catch (e) {
    set({ error: e.message })
    return null
  } finally {
    set({ scanning: false })
    loadGmailConnections()
  }
}

// Once per page load: if a connected mailbox has never been scanned (the OAuth redirect just
// landed), scan it now instead of waiting for the next cron tick.
export async function startFirstScanIfNeeded() {
  if (autoTried || isDemoMode()) return
  autoTried = true
  const conns = state.connections ?? await loadGmailConnections()
  if (conns.some(c => !c.lastScannedAt)) await scanGmailNow()
}

export function useGmailScan({ autoStart = false } = {}) {
  const s = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    if (state.connections === null) loadGmailConnections()
    if (autoStart) startFirstScanIfNeeded()
  }, [autoStart])
  return s
}
