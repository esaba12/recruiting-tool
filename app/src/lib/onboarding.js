// Pure helpers for the first-run wizard (components/onboarding/OnboardingWizard.jsx).

export const STEP_IDS = ['about', 'key', 'gmail', 'calendar', 'data', 'done']
export const STEP_SETTING_KEY = 'onboarding_step'

// The saved step (user_settings.onboarding_step) or the first one. An unknown value (a step
// renamed or removed since it was saved) restarts at the beginning rather than crashing.
export function resumeStep(saved) {
  const step = RENAMED_STEPS[saved] || saved
  return STEP_IDS.includes(step) ? step : STEP_IDS[0]
}

// Gate for AuthGate: show the wizard only once the profile has loaded and it has never been
// completed. A profile that failed to load (null) falls through to the app, not the wizard.
export function needsOnboarding(profile) {
  return !!profile && !profile.onboarded_at
}

// Still getting started: no applications or no contacts yet. Today swaps its "nothing
// needs your attention" message for a getting-started checklist in this state, since
// "you're on top of it" is wrong for an account with nothing in it to be on top of.
export function isFreshAccount({ contacts = [], apps = [] } = {}) {
  return contacts.length === 0 || apps.length === 0
}

// ── v1.4 spec 07 ──

// Saved before v1.4 the last setup step was 'seed' (Targets); it's now 'data' (Bring your data).
const RENAMED_STEPS = { seed: 'data' }

// Where Gmail setup stands, for the wizard, Today's getting-started card and Settings.
// connections: listGmailConnections() result, or null while loading.
//   loading | none | needsKey (connected, but no AI key to classify with) | scanning |
//   waiting (connected, first pass not finished) | done
export function gmailSetupState({ connections, scanning = false, anyAiKey = false, keyLoading = false }) {
  if (connections === null || connections === undefined) return { kind: 'loading' }
  if (!connections.length) return { kind: 'none' }
  const emails = connections.map(c => c.email)
  if (!anyAiKey && !keyLoading) return { kind: 'needsKey', emails }
  if (scanning) return { kind: 'scanning', emails }
  if (connections.some(c => !c.lastScannedAt)) return { kind: 'waiting', emails }
  return { kind: 'done', emails }
}

// Target-company chips pre-filled from imported applications: newest applied date first,
// undated last, deduped by normalized name, minus existing targets, capped.
export const TARGET_SUGGESTION_CAP = 15
export function targetSuggestions(apps, existingTargets = [], cap = TARGET_SUGGESTION_CAP) {
  const key = s => String(s || '').trim().toLowerCase()
  const seen = new Set(existingTargets.map(key))
  const out = []
  const sorted = [...(apps || [])].sort((a, b) => (b.appliedDate || '').localeCompare(a.appliedDate || ''))
  for (const a of sorted) {
    const name = String(a.company || '').trim()
    if (!name || seen.has(key(name))) continue
    seen.add(key(name))
    out.push(name)
    if (out.length >= cap) break
  }
  return out
}

// user_settings 'onboarding_log': every next/skip/back in the wizard, so the owner can see
// with SQL which steps friends skip. Never cleared on finish.
export const ONBOARDING_LOG_KEY = 'onboarding_log'
export const ONBOARDING_LOG_MAX = 50
export function appendOnboardingLog(log, entry) {
  return [...(Array.isArray(log) ? log : []), entry].slice(-ONBOARDING_LOG_MAX)
}
