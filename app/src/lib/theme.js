// Color scheme + light/dark mode. The palettes themselves live in index.css as
// [data-scheme] / [data-mode] blocks on <html>; this module only decides which attributes
// to set, remembers the choice, and syncs it to the account.
//
// Storage: `rec_appearance` in localStorage is deliberately NOT user-scoped (scopedStorage)
// — public/theme-init.js reads it before React or auth exist, to paint the right theme on
// the first frame. The account copy (user_settings key 'appearance') is the source of truth
// across devices; AuthContext pulls it on sign-in and overwrites the local cache.
import { useSyncExternalStore } from 'react'

export const SCHEMES = [
  { id: 'orange', label: 'Safety Orange', ink: '#101215', accent: '#f2680a' },
  { id: 'maize',  label: 'Maize & Blue',  ink: '#061a31', accent: '#ffcb05' },
  { id: 'cobalt', label: 'Cobalt',        ink: '#0e1219', accent: '#2d5ff0' },
  { id: 'patina', label: 'Patina',        ink: '#0c1717', accent: '#0e968a' },
  { id: 'rose',   label: 'Signal Rose',   ink: '#160f14', accent: '#e62e72' },
]
export const MODES = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]
export const APPEARANCE_SETTING_KEY = 'appearance'
const LS_KEY = 'rec_appearance'
const DEFAULT = { scheme: 'orange', mode: 'system' }

const darkQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function normalizeAppearance(a) {
  return {
    scheme: SCHEMES.some(s => s.id === a?.scheme) ? a.scheme : DEFAULT.scheme,
    mode: MODES.some(m => m.id === a?.mode) ? a.mode : DEFAULT.mode,
  }
}

function readCache() {
  try { return normalizeAppearance(JSON.parse(localStorage.getItem(LS_KEY))) } catch { return { ...DEFAULT } }
}

let state = readCache()
const listeners = new Set()

export function resolveMode(mode) {
  if (mode === 'light' || mode === 'dark') return mode
  return darkQuery?.matches ? 'dark' : 'light'
}

function apply() {
  const el = document.documentElement
  el.setAttribute('data-scheme', state.scheme)
  el.setAttribute('data-mode', resolveMode(state.mode))
  listeners.forEach(l => l())
}

darkQuery?.addEventListener?.('change', () => { if (state.mode === 'system') apply() })

/** Apply + cache locally. Returns the normalized value so callers can persist it. */
export function setAppearance(next) {
  state = normalizeAppearance({ ...state, ...next })
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* private mode: still applied for this session */ }
  apply()
  return state
}

function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }
// Snapshot includes the resolved mode so a System-mode OS flip re-renders subscribers.
let snap = null
function getSnapshot() {
  const resolved = resolveMode(state.mode)
  if (!snap || snap.scheme !== state.scheme || snap.mode !== state.mode || snap.resolved !== resolved) {
    snap = { ...state, resolved }
  }
  return snap
}

/** { scheme, mode, resolved: 'light'|'dark' } — re-renders on any theme change. */
export function useAppearance() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Resolves a CSS color custom property on <html> to a hex string, for Recharts/canvas
 * which need real colors. Tokens can be color-mix() expressions (dark mode), so the value is
 * painted onto a 1×1 canvas and read back rather than trusting the browser to serialize it.
 */
let probe = null
export function cssColor(name) {
  if (typeof document === 'undefined') return '#000'
  probe ||= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const el = document.createElement('span')
  el.style.color = `var(${name})`
  el.style.display = 'none'
  document.documentElement.appendChild(el)
  const computed = getComputedStyle(el).color
  el.remove()
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = computed
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")
}
