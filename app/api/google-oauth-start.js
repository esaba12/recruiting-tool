// GET /api/google-oauth-start?slot=personal|school -> { authUrl }
// Authenticated (client sends the Supabase session JWT), so we can safely mint a
// tamper-proof `state` binding this request to the caller's user id + chosen slot —
// api/google-oauth-callback.js decrypts it to know whose token to store, without ever
// needing its own auth header (it's hit by a plain browser redirect from Google, which
// can't carry one).
import { requireUser } from './_lib/supabaseAdmin.js'
import { encrypt } from './_lib/crypto.js'
import { CALENDAR_SLOTS, CALENDAR_OAUTH_SCOPE, redirectUri } from './_lib/googleOAuth.js'

const STATE_TTL_MS = 10 * 60 * 1000 // plenty for a consent flow; short enough to bound a stolen/leaked state's blast radius

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const slot = req.query.slot
  if (!CALENDAR_SLOTS[slot]) {
    return res.status(400).json({ error: { message: `slot must be one of: ${Object.keys(CALENDAR_SLOTS).join(', ')}` } })
  }

  const state = encrypt(JSON.stringify({ userId: user.id, slot, exp: Date.now() + STATE_TTL_MS }))

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: CALENDAR_OAUTH_SCOPE,
    access_type: 'offline',
    // select_account (not just consent) so a browser with only one active Google
    // session still gets an explicit account chooser — important here since the whole
    // point is picking a DIFFERENT account than whatever's already connected.
    prompt: 'consent select_account',
    state,
  })}`

  res.status(200).json({ authUrl })
}
