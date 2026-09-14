// POST /api/events-ingest — pulls the caller's school's event feeds into the
// shared pool (service-role write path; see api/_lib/eventsIngest.js).
//   { mode: 'run', force?: bool }                  → server-side pull of every due source
//   { mode: 'relay', ref: '<source ref>', payload } → browser-fetched feed payload for one source
import { requireUser } from './_lib/supabaseAdmin.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'
import { runIngest } from './_lib/eventsIngest.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const rl = await checkRateLimit(user.id, 'INGEST')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const mode = body.mode === 'relay' ? 'relay' : 'run'
  if (mode === 'relay' && (body.ref == null || body.payload == null)) {
    return res.status(400).json({ error: { message: 'relay needs { ref, payload }' } })
  }
  try {
    const result = await runIngest({ user, mode, ref: body.ref, payload: body.payload, force: !!body.force })
    return res.status(200).json(result)
  } catch (e) {
    return res.status(e.status || 500).json({ error: { message: e.message } })
  }
}
