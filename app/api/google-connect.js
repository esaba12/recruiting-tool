// Status + disconnect for a connected Google Calendar slot ('personal' | 'school', see
// _lib/googleOAuth.js). Storing the token itself happens in api/google-oauth-callback.js,
// the tail end of the direct-OAuth flow — its path is registered as a live redirect_uri in
// Google Cloud Console, so it stays its own file/path (unlike google-oauth-start.js, folded
// in here as the `?action=start` branch below, to stay under Vercel Hobby's
// 12-serverless-function cap — start.js had no external dependency on its own path).
//
// GET    /api/google-connect?slot=personal|school -> { connected, email, canManageCalendars }
// GET    /api/google-connect?slot=...&action=start -> { authUrl } (kick off the OAuth redirect)
// DELETE /api/google-connect?slot=personal|school -> disconnect that slot
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { encrypt } from './_lib/crypto.js'
import { CALENDAR_SLOTS, CALENDAR_APP_CREATED_SCOPE, CALENDAR_OAUTH_SCOPE, hasCalendarScope, redirectUri } from './_lib/googleOAuth.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'

const STATE_TTL_MS = 10 * 60 * 1000 // plenty for a consent flow; short enough to bound a stolen/leaked state's blast radius

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const slot = req.query.slot || 'personal'
  if (!CALENDAR_SLOTS[slot]) {
    return res.status(400).json({ error: { message: `slot must be one of: ${Object.keys(CALENDAR_SLOTS).join(', ')}` } })
  }

  if (req.method === 'GET' && req.query.action === 'start') {
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
    return res.status(200).json({ authUrl })
  }

  const rl = await checkRateLimit(user.id, 'CRUD')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('google_calendar_tokens')
      .select('connected_email, updated_at, scopes')
      .eq('user_id', user.id)
      .eq('slot', slot)
      .maybeSingle()
    if (error) return res.status(500).json({ error: { message: error.message } })
    // canManageCalendars: this slot consented to calendar.app.created, so the app can
    // create/write the dedicated Recruiting calendar. Older grants (scopes null) can't
    // until the user reconnects the slot.
    return res.status(200).json({
      connected: !!data, email: data?.connected_email || null,
      canManageCalendars: !!data && hasCalendarScope(data.scopes, CALENDAR_APP_CREATED_SCOPE),
    })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('google_calendar_tokens').delete().eq('user_id', user.id).eq('slot', slot)
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: false })
  }

  res.setHeader('Allow', 'GET, DELETE')
  return res.status(405).json({ error: { message: 'Method not allowed' } })
}
