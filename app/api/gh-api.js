// Proxies api.github.com. GITHUB_TOKEN is optional (raises rate limits from the
// public 60/hr ceiling) — unlike the AI/Exa proxies, this still works with no
// BYOK key set, just at the lower unauthenticated rate limit.
//
// The unauthenticated `?upstream=contrib` branch (a third-party contribution-graph API) went
// with the Job Boards GitHub profile lookup in v1.4 spec 05 B.
import { requireUser } from './_lib/supabaseAdmin.js'
import { getUserKey } from './_lib/keys.js'
import { checkRateLimit, sendRateLimited } from './_lib/rateLimit.js'
import { buildLeetcodeRequest, leetcodeHeaders, LEETCODE_GRAPHQL } from './_lib/leetcode.js'

function extraQuery(query) {
  const { path, upstream, ...rest } = query
  const qs = new URLSearchParams(rest).toString()
  return qs ? `?${qs}` : ''
}

export default async function handler(req, res) {
  const user = await requireUser(req)
  if (!user) return res.status(401).json({ error: { message: 'Not authenticated' } })

  const rl = await checkRateLimit(user.id, 'GITHUB')
  if (rl.limited) return sendRateLimited(res, rl.retryAfter)

  // LeetCode public GraphQL (Learn tab import) — also folded in here for the function cap.
  // Auth-gated + rate-limited like the rest, and only runs server-owned queries
  // (see _lib/leetcode.js) — the client sends { op, username | slugs }, never GraphQL.
  if (req.query.upstream === 'leetcode') {
    if (req.method !== 'POST') return res.status(405).json({ error: { message: 'POST only' } })
    let gql
    try { gql = buildLeetcodeRequest(req.body) } catch (e) {
      return res.status(e.status || 400).json({ error: { message: e.message } })
    }
    // `session` (history op only) goes into the Cookie header, never into the body or a log.
    const upstream = await fetch(LEETCODE_GRAPHQL, {
      method: 'POST',
      headers: await leetcodeHeaders(gql),
      body: JSON.stringify({ query: gql.query, variables: gql.variables }),
    })
    const data = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(data)
  }

  const path = req.query.path || ''
  // repos/ (job boards, company prep) and orgs/ (Explore's GitHub badge) only.
  if (!/^(repos|orgs)\//.test(path)) {
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
