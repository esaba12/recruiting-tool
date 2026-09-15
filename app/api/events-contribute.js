// POST /api/events-contribute — user-contributed events (paste / CSV / ICS / manual)
// into the shared pool via the service role, with dedup + confidence gate
// (api/_lib/eventsContribute.js).
//   { items: [EventDraft], share: bool }  → { results: [{ status, eventId, reason }] }
//   { promote: eventId }                  → make one of my private events shared
//   { remove: eventId }                   → delete one of my private events
import { requireUser } from './_lib/supabaseAdmin.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'
import { contributeEvents, promoteEvent, removeOwnEvent } from './_lib/eventsContribute.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })
  const rl = await checkRateLimit(user.id, 'INGEST')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  try {
    if (body.promote) return res.status(200).json(await promoteEvent({ user, eventId: String(body.promote) }))
    if (body.remove) return res.status(200).json(await removeOwnEvent({ user, eventId: String(body.remove) }))
    return res.status(200).json(await contributeEvents({ user, items: body.items, share: body.share !== false }))
  } catch (e) {
    return res.status(e.status || 500).json({ error: { message: e.message } })
  }
}
