// Shared between google-oauth-start.js and google-oauth-callback.js — the two halves
// of a direct (non-Supabase) Google OAuth flow used specifically for connecting Calendar
// access. Deliberately NOT routed through supabase.auth.signInWithOAuth()/linkIdentity():
// those manage the app's *login* identity and either risk switching the active session to
// a different account (signInWithOAuth) or only support one linked identity per provider
// (linkIdentity) — neither supports "connect two unrelated Google accounts for calendar
// reads while staying signed into the same app account throughout," which is exactly what
// personal+school calendars need. This flow talks to Google's OAuth endpoints directly,
// the same GOOGLE_CLIENT_ID/SECRET already used elsewhere, just with its own redirect URI.
import crypto from 'crypto'

export const CALENDAR_SLOTS = {
  personal: 'Personal',
  school: 'School',
}

// calendar.events: read/write events on the user's own calendars (class schedule reads,
// the legacy primary-calendar "+ Event" flow). calendar.app.created (added for Recruiting
// Events, non-sensitive): create + manage a secondary calendar this app owns — the
// dedicated "Recruiting" calendar events are pushed to, never primary. Users who
// consented before this scope existed keep working for everything but the Recruiting
// calendar until they reconnect the slot (Settings shows a nudge; see hasCalendarScope).
export const CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'
export const CALENDAR_APP_CREATED_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
export const CALENDAR_OAUTH_SCOPE = `${CALENDAR_EVENTS_SCOPE} ${CALENDAR_APP_CREATED_SCOPE} email`

export function hasCalendarScope(scopes, scope) {
  return String(scopes || '').split(/\s+/).includes(scope)
}

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

// gmail.readonly: read-only access to list/read messages for the networking pipeline
// (api/_lib/emailPipeline.js, api/gmail-scan.js) — a Google *restricted* scope (same
// unverified-app Testing-mode situation as CALENDAR_APP_CREATED_SCOPE above: capped at
// ~100 test users + a click-through warning until the OAuth consent screen goes through
// Google's verification/security review). Deliberately not gmail.modify/gmail.labels —
// this pipeline never writes to Gmail (no labels, no sending), so the narrowest scope
// that can actually read message content is all it asks for.
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
export const GMAIL_OAUTH_SCOPE = `${GMAIL_READONLY_SCOPE} email`

// Single consolidated endpoint (api/gmail.js) handles start/callback/connect/scan — see its
// header comment for why (Vercel Hobby's 12-serverless-function cap).
export function gmailRedirectUri(req) {
  return `${baseUrl(req)}/api/gmail`
}

// ── Callback hardening ────────────────────────────────────────────────────────
// Both OAuth callbacks (google-oauth-callback.js, gmail.js) render a small HTML error page
// from values that arrive in Google's redirect query string (`?error=`) or upstream error
// text — anyone can craft that URL, so everything interpolated into the page is escaped.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

// The encrypted `state` proves *which app user* started a flow, but not *which browser* is
// finishing it — without this, an attacker could mint a state for their own account and
// trick a victim into approving Google's consent screen, filing the victim's Gmail/Calendar
// token under the attacker's user id. The start leg (a same-origin, authenticated fetch)
// sets a random nonce in an HttpOnly cookie and embeds the same nonce in `state`; the
// callback (a top-level GET from Google, so SameSite=Lax still sends it) requires both to
// match. A victim's browser never has the attacker's cookie, so the forged flow is refused.
const NONCE_TTL_S = 10 * 60

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

function nonceCookie(req, name, value, maxAge) {
  const secure = baseUrl(req).startsWith('https://') ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function issueOAuthNonce(req, res, name) {
  const nonce = crypto.randomBytes(24).toString('base64url')
  res.setHeader('Set-Cookie', nonceCookie(req, name, nonce, NONCE_TTL_S))
  return nonce
}

// Returns true only if the cookie matches the nonce carried in the decrypted state; always
// clears the cookie so a nonce can't be replayed by a second callback.
export function consumeOAuthNonce(req, res, name, expected) {
  const actual = readCookie(req, name)
  res.setHeader('Set-Cookie', nonceCookie(req, name, '', 0))
  if (!actual || !expected || actual.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}
