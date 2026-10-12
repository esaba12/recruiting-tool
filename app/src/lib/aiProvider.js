// Dependency-free provider resolution for lib/ai.js (kept apart so it's unit-testable
// without pulling in the Supabase client). The per-user profile choice wins; the build-time
// VITE_AI_PROVIDER env var is only the default for users who haven't chosen.
export const normalizeProvider = (p) => {
  const v = typeof p === 'string' ? p.trim().toLowerCase() : ''
  return v === 'openai' || v === 'claude' ? v : null
}

export const envDefaultProvider = (env = import.meta.env?.VITE_AI_PROVIDER) => normalizeProvider(env) || 'claude'

export const resolveProvider = (chosen, env) => normalizeProvider(chosen) || envDefaultProvider(env)

// BYOK key slot for a provider ('claude' -> the 'anthropic' key).
export const keyProviderFor = (provider) => (provider === 'openai' ? 'openai' : 'anthropic')

export const providerLabel = (provider) => (provider === 'openai' ? 'GPT' : 'Claude')
