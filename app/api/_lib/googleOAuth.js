// Shared between google-oauth-start.js and google-oauth-callback.js — the two halves
// of a direct (non-Supabase) Google OAuth flow used specifically for connecting Calendar
// access. Deliberately NOT routed through supabase.auth.signInWithOAuth()/linkIdentity():
// those manage the app's *login* identity and either risk switching the active session to
// a different account (signInWithOAuth) or only support one linked identity per provider
// (linkIdentity) — neither supports "connect two unrelated Google accounts for calendar
// reads while staying signed into the same app account throughout," which is exactly what
// personal+school calendars need. This flow talks to Google's OAuth endpoints directly,
// the same GOOGLE_CLIENT_ID/SECRET already used elsewhere, just with its own redirect URI.

export const CALENDAR_SLOTS = {
  personal: 'Personal',
  school: 'School',
}

export const CALENDAR_OAUTH_SCOPE = 'https://www.googleapis.com/auth/calendar.events email'

// Derives this deployment's own origin from the incoming request rather than a hardcoded
// env var, so the same code works unmodified against localhost in dev and whatever domain
// Vercel serves in preview/production — the redirect_uri just has to be self-consistent
// between the start and callback legs of a single flow, not globally fixed.
export function baseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function redirectUri(req) {
  return `${baseUrl(req)}/api/google-oauth-callback`
}
