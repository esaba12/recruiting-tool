import { supabase, authHeader } from './supabaseClient.js'

// "Sign in with Google" — plain login, no extra scopes. Used by LoginPage.jsx.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

// "Link Google account" — attaches a Google identity to the CURRENTLY signed-in
// user (unlike signInWithGoogle, which authenticates a session from scratch).
// Used by SettingsTab.jsx to give an accounts created via "sign in with API key"
// (apiKeyAuth.js) a recovery path that doesn't depend on that key: if the key is
// ever rotated, "Continue with Google" still gets back into the same account.
export async function linkGoogleIdentity() {
  const { error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

// "Connect Calendar" (personal or school slot — see api/_lib/googleOAuth.js's
// CALENDAR_SLOTS) — a direct Google OAuth flow (api/google-oauth-start.js +
// api/google-oauth-callback.js), NOT supabase.auth.signInWithOAuth()/linkIdentity().
// Deliberately: signInWithOAuth risks switching the active login session to a different
// account if the Google identity picked isn't already this account's, and linkIdentity
// only supports one linked identity per provider — neither lets someone connect a SECOND,
// unrelated Google account (the whole point of a school+personal split) while staying
// signed into the same app account. This flow is fully independent of login identity: it
// just asks Google for calendar.events access and stores the resulting refresh token
// against whichever slot was requested.
export async function connectGoogleCalendar(slot = 'personal') {
  const res = await fetch(`/api/google-oauth-start?slot=${slot}`, { headers: await authHeader() })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message || 'Failed to start Google Calendar connection')
  }
  const { authUrl } = await res.json()
  window.location.href = authUrl // full-page redirect to Google; api/google-oauth-callback.js sends the browser back here on success
}

export async function getGoogleCalendarStatus(slot = 'personal') {
  const res = await fetch(`/api/google-connect?slot=${slot}`, { headers: await authHeader() })
  if (!res.ok) return { connected: false, email: null }
  return res.json()
}

export async function disconnectGoogleCalendar(slot = 'personal') {
  const res = await fetch(`/api/google-connect?slot=${slot}`, { method: 'DELETE', headers: await authHeader() })
  if (!res.ok) throw new Error('Failed to disconnect')
  return res.json()
}
