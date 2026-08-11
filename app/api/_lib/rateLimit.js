// Per-user rate limiting for the proxy endpoints, backed by Upstash Redis
// (provisioned via Vercel Marketplace: `vercel integration add upstash` ->
// "Upstash for Redis"). The Marketplace integration injects Vercel's legacy
// @vercel/kv-compatible names (KV_REST_API_URL/KV_REST_API_TOKEN), NOT the
// raw Upstash names (UPSTASH_REDIS_REST_URL/TOKEN) despite Upstash's own docs
// showing the latter — confirmed against this project's actual `vercel env
// ls` output on 2026-08-10. We check both so this also works if a future
// integration version (or a manually-added Upstash account) uses the raw names.
//
// Fails OPEN (no-op, request proceeds) if neither pair is set — so local dev
// and any deploy that hasn't provisioned Upstash still work; this is a
// defense-in-depth layer against cost/abuse, not an auth gate, so "briefly
// unlimited before setup" is an acceptable tradeoff over hard-failing every
// request with no rate limiter configured.
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let redis = null
let configured = null // cache the "did we even try" check

function getRedis() {
  if (configured === false) return null
  if (redis) return redis
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    configured = false
    return null
  }
  redis = new Redis({ url, token })
  configured = true
  return redis
}

const limiters = new Map() // "windowSpec:limit" -> Ratelimit instance, memoized across invocations

function getLimiter(limit, window) {
  const r = getRedis()
  if (!r) return null
  const cacheKey = `${limit}:${window}`
  if (!limiters.has(cacheKey)) {
    limiters.set(cacheKey, new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: 'ratelimit',
      analytics: false,
    }))
  }
  return limiters.get(cacheKey)
}

// Named tiers so call sites read as intent, not raw numbers.
export const RATE_LIMITS = {
  AI: { limit: 30, window: '60 s' },       // Claude/OpenAI text+vision calls — real $ per request
  SEARCH: { limit: 30, window: '60 s' },   // Exa search/contents/findSimilar
  GITHUB: { limit: 60, window: '60 s' },   // README/user fetches — cheap but can burn the shared token's rate limit
  CALENDAR: { limit: 60, window: '60 s' }, // list/create/delete events
  CRUD: { limit: 20, window: '60 s' },     // BYOK key + calendar-connect management
}

// Returns { limited: false } if allowed (or if Upstash isn't configured — fail
// open), or { limited: true, retryAfter } if the caller should get a 429.
export async function checkRateLimit(userId, tier) {
  const { limit, window } = RATE_LIMITS[tier]
  const limiter = getLimiter(limit, window)
  if (!limiter) return { limited: false }
  const { success, reset } = await limiter.limit(`${tier}:${userId}`)
  if (success) return { limited: false }
  return { limited: true, retryAfter: Math.max(1, Math.ceil((reset - Date.now()) / 1000)) }
}

// Shared 429 responder so every handler sends the same shape.
export function sendRateLimited(res, retryAfter) {
  res.setHeader('Retry-After', String(retryAfter))
  return res.status(429).json({ error: { message: 'Rate limit exceeded — please slow down and try again shortly.' } })
}
