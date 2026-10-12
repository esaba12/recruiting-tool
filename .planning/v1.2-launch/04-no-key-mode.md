# 04 — No-key mode + guided key setup

## Problem

Every AI, search, and enrichment feature needs a per-user Anthropic or OpenAI key (Exa is needed
for Discover/Explore/deadlines). Without one, the proxy returns 400 with
"Add your Anthropic API key in Settings…" (`api/claude-api.js:28`), which surfaces as an inline
error *after* the user clicks. Most non-SWE friends won't have a key, so the first AI button they
press fails. The app needs to be clearly useful without a key, and adding one needs to feel easy.

## Change

### 1. Key status in context
- Add a `useKeyStatus()` hook (`app/src/lib/useKeyStatus.js`) that reads the existing `GET /api/keys` (returns providers + last4, never the key) once per session and exposes `{ ai: bool, exa: bool, loading }`. `ai` is true if the user's selected `ai_provider` has a key.
- Provide it from `AppInner` (same place `useLearning` is mounted) so any component can read it.

### 2. Disable before click, not after
- A small `<NeedsKey kind="ai"|"exa">` wrapper renders its child disabled, with a tooltip and a one-tap link: "Needs an AI key — add one in Settings (2 min)".
- Apply it at the AI entry points. Grep for `aiJSON(`/`aiText(` callers and `exaSearch`/`companySearch`/`discoverPeople`, and wrap the button that triggers each one. Expected set: Quick Add auto-fill, LogInteraction "Extract", DraftPanel/TextDraftPanel, Explore refresh, Discover refresh, Learn coach/explain-back/AI topic suggestions, EventImportModal paste-extract, AddToCalendarModal (vision), job-fit analysis, deadline extraction.
- Background passes that call AI without a click (Discover/Explore daily refresh, event enrichment, deadline extraction, timeline scan) check `useKeyStatus` first and **skip silently** instead of firing and failing. Several already fail soft. The point here is to avoid wasted requests and console noise.
- Gmail scanning without a key already shows a warning in Settings (`SettingsTab.jsx:329`). Mirror that warning in onboarding step 3.

### 3. Guided key setup (reused by onboarding step 2 and Settings)
`components/onboarding/GetAKey.jsx`:
- Three numbered steps with deep links: console.anthropic.com → Billing → add $5 credit → API Keys → Create key → paste.
- A rough cost line ("light use is about $1–3/month on Haiku"). Check this against current Haiku pricing via the `claude-api` skill before shipping. Don't guess.
- Note that the key is encrypted at rest and never shown back, matching how `api/keys.js` already behaves.
- An Exa line: optional, and only powers Discover/Explore people and company search. Say whether a free tier exists only after checking current Exa pricing.

### Rejected alternative: a shared trial budget on the owner's key
This would mean a server-side fallback key plus per-user metering (a new table, a new code path in
every AI proxy, and the owner paying for strangers). It also reverses the deliberate "no global
keys" stance in CLAUDE.md (Multi-Tenant Auth + BYOK). Revisit only if friend feedback says key
setup is the reason people drop off.

## Tests / verification

- Unit: `useKeyStatus` mapping (provider selection × stored keys → `ai`).
- Manual: an account with no keys clicks through every tab, and no red error banners appear. Every AI button is visibly disabled with the explainer. The network tab shows zero 400s from `/claude-api`, `/openai-api`, or `/exa` on page load.
- Manual: add a key and confirm buttons enable without a reload (the hook re-fetches after `POST /api/keys`).

## Acceptance

A user with no keys never sees an AI error they didn't ask for, and is always one tap away from
setup instructions.
