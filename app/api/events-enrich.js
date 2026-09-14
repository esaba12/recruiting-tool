// POST /api/events-enrich — commits client-extracted event attributes, requirement
// ladders and registration deadlines to the shared pool (service-role write;
// validation in api/_lib/eventsEnrich.js).
import { requireUser } from './_lib/supabaseAdmin.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'
import { commitEnrichment } from './_lib/eventsEnrich.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })
  const rl = await checkRateLimit(user.id, 'INGEST')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)
  const body = req.body && typeof req.body === 'object' ? req.body : {}
  try {
    return res.status(200).json(await commitEnrichment({ user, items: body.items, deadlines: body.deadlines }))
  } catch (e) {
    return res.status(e.status || 500).json({ error: { message: e.message } })
  }
}
