// Proxies api.github.com. GITHUB_TOKEN is optional (raises rate limits from the
// public 60/hr ceiling) — unlike the AI/Exa proxies, this still works with no
// BYOK key set, just at the lower unauthenticated rate limit.
//
// Also handles the old api/gh-contrib.js proxy (github-contributions-api.jogruber.de,
// public, no auth) — folded in here (via vercel.json's rewrite passing `?upstream=contrib`)
// to stay under Vercel Hobby's 12-serverless-function cap. That upstream is fully public,
// so its branch below deliberately skips requireUser()/rate-limiting/the path allowlist —
// same no-auth-gate behavior the standalone file always had.
import { requireUser } from './_lib/supabaseAdmin.js'
import { getUserKey } from './_lib/keys.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'

function extraQuery(query) {
  const { path, upstream, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

export default async function handler(req, res) {
  if (req.query.upstream === 'contrib') {
    const target = `https://github-contributions-api.jogruber.de/${req.query.path || ''}${extraQuery(req.query)}`
    const upstream = await fetch(target)
    const data = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
    return res.send(data)
  }

  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const rl = await checkRateLimit(user.id, 'GITHUB')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  const path = req.query.path || ''
  if (!/^(repos|users|orgs)\//.test(path)) {
    return res.status(403).json({ error: { message: 'Path not allowed' } })
  }

  const target = `https://api.github.com/${path}${extraQuery(req.query)}`

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'recruiting-os-dashboard',
  }
  const token = await getUserKey(user.id, 'github')
  if (token) headers['Authorization'] = `Bearer ${token}`

  const upstream = await fetch(target, { headers })
  const data = await upstream.text()
  res.status(upstream.status)
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')
  res.send(data)
}
