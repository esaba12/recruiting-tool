// Status + disconnect for a connected Google Calendar slot ('personal' | 'school', see
// _lib/googleOAuth.js). Storing the token itself now happens in
// api/google-oauth-callback.js, the tail end of the direct-OAuth flow started by
// api/google-oauth-start.js — this endpoint no longer accepts a POST.
//
// GET    /api/google-connect?slot=personal|school -> { connected: boolean, email: string|null }
// DELETE /api/google-connect?slot=personal|school -> disconnect that slot
import { requireUser, supabaseAdmin } from './_lib/supabaseAdmin.js'
import { CALENDAR_SLOTS } from './_lib/googleOAuth.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const rl = await checkRateLimit(user.id, 'CRUD')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  const slot = req.query.slot || 'personal'
  if (!CALENDAR_SLOTS[slot]) {
    return res.status(400).json({ error: { message: `slot must be one of: ${Object.keys(CALENDAR_SLOTS).join(', ')}` } })
  }

  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('google_calendar_tokens')
      .select('connected_email, updated_at')
      .eq('user_id', user.id)
      .eq('slot', slot)
      .maybeSingle()
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: !!data, email: data?.connected_email || null })
  }

  if (req.method === 'DELETE') {
    const { error } = await db.from('google_calendar_tokens').delete().eq('user_id', user.id).eq('slot', slot)
    if (error) return res.status(500).json({ error: { message: error.message } })
    return res.status(200).json({ connected: false })
  }

  res.setHeader('Allow', 'GET, DELETE')
  return res.status(405).json({ error: { message: 'Method not allowed' } })
}
