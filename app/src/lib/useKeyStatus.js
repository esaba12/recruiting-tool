// Which BYOK keys the signed-in user has — read once per session from GET /api/keys
// (providers + last4 only, never the key) into lib/keyStore.js, shared by every caller,
// so AI buttons can be disabled *before* a click instead of surfacing the proxy's 400
// after one. Call refreshKeyStatus() after any key save/remove.
import { useEffect, useSyncExternalStore } from 'react'
import { authHeader } from './supabaseClient.js'
import { AI_PROVIDER } from './ai.js'
import { keyStatus } from './keyStatus.js'
import { getKeyState, setKeyState, subscribeKeyState } from './keyStore.js'
import { useAuth } from './AuthContext.jsx'

// lib/ai.js's provider is chosen at build time, so that's the key AI calls actually use.
export const AI_KEY_PROVIDER = AI_PROVIDER === 'openai' ? 'openai' : 'anthropic'
const isDemoMode = () => typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

let inflight = null
let retryTimer = null
const RETRY_MS = 30000

export async function refreshKeyStatus(userId = getKeyState().userId) {
  if (!userId) return
  if (getKeyState().userId !== userId) setKeyState({ userId, loading: true, keys: {} })
  const p = (async () => {
    try {
      const res = await fetch('/api/keys', { headers: await authHeader() })
      if (!res.ok) throw new Error(`keys ${res.status}`)
      const rows = await res.json()
      if (getKeyState().userId === userId) setKeyState({ userId, loading: false, keys: Object.fromEntries(rows.map(r => [r.provider, !!r.hasKey])) })
    } catch {
      // Unknown, not "missing" (e.g. a 429 from the CRUD rate limit): fail open so AI buttons
      // stay usable and the proxy remains the source of truth, then try again shortly.
      if (getKeyState().userId === userId) {
        setKeyState({ userId, loading: false, unknown: true, keys: {} })
        clearTimeout(retryTimer)
        retryTimer = setTimeout(() => { if (getKeyState().userId === userId) refreshKeyStatus(userId) }, RETRY_MS)
      }
    }
  })()
  inflight = p
  await p
  if (inflight === p) inflight = null
}

export default function useKeyStatus(userId) {
  const s = useSyncExternalStore(subscribeKeyState, getKeyState)
  const demo = isDemoMode()
  useEffect(() => {
    if (demo || !userId) return
    if (getKeyState().userId !== userId) refreshKeyStatus(userId)
  }, [userId, demo])
  // /demo has no account, so every AI proxy would 401 — NeedsKey explains "sign up" there.
  if (demo) return { loading: false, ai: false, exa: false, aiProvider: AI_KEY_PROVIDER, demo: true }
  if (s.userId !== userId) return { loading: true, ai: false, exa: false, aiProvider: AI_KEY_PROVIDER }
  return keyStatus(s, AI_KEY_PROVIDER)
}

// For background passes (daily Explore/Discover refresh, timeline scan, event enrichment,
// job-deadline extraction): true only once the key status has loaded AND every listed key
// is present, so those passes neither race the status read nor fire requests that can only 400.
export function useKeysReady(...kinds) {
  const { user } = useAuth()
  const s = useKeyStatus(user?.id)
  return !s.loading && kinds.every(k => s[k])
}
