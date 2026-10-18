// Namespaces every `rec_*` localStorage key by the signed-in user's id, so two
// different accounts sharing one browser never see each other's cached
// preferences/discovery state (target companies, affinity profile, tracked
// boards, etc.). AuthContext.jsx calls setStorageUserId() on every auth state
// change; falls back to 'anon' before the session is known (first paint).
//
// Deliberate scope decision: this is per-browser caching, not synced storage —
// namespacing prevents cross-account leakage, but it does NOT make this data
// available across devices (same limitation the single-tenant app already
// had). Full server-side sync would mean a much larger rewrite of every
// caller; not done here — see CLAUDE.md.
let currentUserId = 'anon'

export function setStorageUserId(id) {
  currentUserId = id || 'anon'
}

function scopedKey(key) {
  return `${currentUserId}:${key}`
}

// /demo keeps these in memory instead (seeded by DemoApp from demoData.js), so a visitor's
// clicks reset on reload like the rest of the demo, and never land in a real user's cache.
let demoStore = null
export function enableDemoStorage(seed = {}) {
  demoStore = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]))
}

export function lsGet(key) {
  if (demoStore) { try { return JSON.parse(demoStore.get(key) ?? 'null') } catch { return null } }
  try { return JSON.parse(localStorage.getItem(scopedKey(key))) || null } catch { return null }
}

export function lsSet(key, val) {
  if (demoStore) { demoStore.set(key, JSON.stringify(val)); return }
  localStorage.setItem(scopedKey(key), JSON.stringify(val))
}
