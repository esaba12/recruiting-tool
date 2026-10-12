// Pure helpers for the first-run wizard (components/onboarding/OnboardingWizard.jsx).

export const STEP_IDS = ['about', 'key', 'gmail', 'calendar', 'seed', 'done']
export const STEP_SETTING_KEY = 'onboarding_step'

// The saved step (user_settings.onboarding_step) or the first one. An unknown value (a step
// renamed or removed since it was saved) restarts at the beginning rather than crashing.
export function resumeStep(saved) {
  return STEP_IDS.includes(saved) ? saved : STEP_IDS[0]
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
