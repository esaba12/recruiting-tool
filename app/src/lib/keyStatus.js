// Pure half of useKeyStatus.js — split out so it's testable without the Supabase client.
// state: { loading, unknown?, keys: { [provider]: bool } }; aiKeyProvider: 'anthropic' | 'openai'.
// `unknown` (the status read failed) reports every key as present: fail open, so a flaky
// read never locks a user with real keys out of AI features.
export function keyStatus(state, aiKeyProvider = 'anthropic') {
  if (state.unknown) return { loading: false, ai: true, exa: true, aiProvider: aiKeyProvider, unknown: true }
  return { loading: state.loading, ai: !!state.keys[aiKeyProvider], exa: !!state.keys.exa, aiProvider: aiKeyProvider }
}
