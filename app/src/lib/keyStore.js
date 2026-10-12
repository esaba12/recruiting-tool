// Session-wide record of which BYOK keys the signed-in user has (filled by
// useKeyStatus.js from GET /api/keys). Dependency-free on purpose: lib/claude.js,
// lib/openai.js and lib/exa.js import assertKey() to fail fast — before any network
// call — when a key is *known* to be missing, so background passes don't fire requests
// that can only 400. While the status is unknown (still loading, or never loaded)
// calls go through and the proxy stays the source of truth.

let state = { userId: null, loading: true, keys: {} }
const listeners = new Set()

export function getKeyState() { return state }
export function setKeyState(next) { state = next; listeners.forEach(l => l()) }
export function subscribeKeyState(l) { listeners.add(l); return () => listeners.delete(l) }

const MESSAGES = {
  anthropic: 'Add your Anthropic API key in Settings to enable AI features.',
  openai: 'Add your OpenAI API key in Settings to enable AI features.',
  exa: 'Add your Exa API key in Settings to enable web search.',
}

export class MissingKeyError extends Error {
  constructor(provider) {
    super(MESSAGES[provider] || 'Add an API key in Settings.')
    this.name = 'MissingKeyError'
    this.provider = provider
  }
}

export function keyKnownMissing(provider) {
  return !state.loading && !state.unknown && state.userId != null && !state.keys[provider]
}

export function assertKey(provider) {
  if (keyKnownMissing(provider)) throw new MissingKeyError(provider)
}
