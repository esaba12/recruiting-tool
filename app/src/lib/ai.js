import { claudeJSON, claudeText, CLAUDE_MODELS } from './claude.js'
import { openaiJSON, openaiText, OPENAI_MODELS } from './openai.js'
import { envDefaultProvider, resolveProvider, providerLabel } from './aiProvider.js'

// Single switch for every text-only AI call in the app. Defaults to Claude — the default
// flips by setting VITE_AI_PROVIDER=openai in .env (repo root, same place NOTION_API_KEY etc.
// live) and restarting the dev server, or by setting the same var in Vercel's env vars
// for production. No code edit required either way.
//
// Both providers are always wired and ready (see lib/claude.js / lib/openai.js) — this
// file only decides which one every `aiJSON`/`aiText` call actually hits, via one
// resolved constant, so switching is a one-line env change instead of touching the ~8
// call sites (job blurbs/analysis, deadline extraction, contact enrichment, company
// ranking, call/email/LinkedIn extraction, timeline scanning, drafting).
//
// Vision (AddToCalendarModal's screenshot→event extraction) is NOT part of this switch —
// it always calls lib/claude.js's Sonnet vision directly, since OpenAI's image
// content-block format differs enough to need its own tested migration.
// Runtime state, not a constant: the signed-in user's profile.ai_provider (pushed in by
// AuthContext via setAiProvider) overrides the env default, and can change mid-session.
let current = envDefaultProvider()
export const setAiProvider = (p) => { current = resolveProvider(p) }
export const getAiProvider = () => current
export const aiProviderLabel = () => providerLabel(current)

// Provider-agnostic model tiers — MINI for cheap/fast structured extraction, STANDARD
// for heavier judgment calls (company ranking, call/email extraction). Getters resolve
// against the current provider on every access, so call sites keep reading
// `AI_MODELS.MINI` as a plain value without knowing the provider can change.
const TIER_MAP = {
  claude: { MINI: CLAUDE_MODELS.HAIKU, STANDARD: CLAUDE_MODELS.SONNET },
  openai: { MINI: OPENAI_MODELS.MINI, STANDARD: OPENAI_MODELS.STANDARD },
}
export const AI_MODELS = {
  get MINI() { return TIER_MAP[current].MINI },
  get STANDARD() { return TIER_MAP[current].STANDARD },
}

export async function aiText({ model, content, maxTokens }) {
  return current === 'openai'
    ? openaiText({ model, content, maxTokens })
    : claudeText({ model, content, maxTokens })
}

export async function aiJSON({ model, content, maxTokens }) {
  return current === 'openai'
    ? openaiJSON({ model, content, maxTokens })
    : claudeJSON({ model, content, maxTokens })
}
