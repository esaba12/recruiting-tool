// v1.4 spec 07: POST /api/gmail?action=scan-mine scans the signed-in user's own mailboxes now,
// instead of waiting up to 10 minutes for the cron tick, so onboarding ends with data on screen.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ user: null, tokens: [], updates: [], scanned: [], limited: false }))

vi.mock('../api/_lib/supabaseAdmin.js', () => {
  // Minimal chainable query: select('*').eq('user_id', id) filters tokens; update().eq() records.
  const db = {
    from: table => {
      const q = { filters: [] }
      const api = {
        select: () => api,
        eq: (col, val) => { q.filters.push([col, val]); return api },
        order: () => api,
        maybeSingle: async () => ({ data: null, error: null }),
        update: patch => { q.patch = patch; return api },
        then: (resolve) => {
          if (q.patch) { state.updates.push({ table, patch: q.patch, filters: q.filters }); return resolve({ error: null }) }
          const rows = table === 'gmail_tokens' ? state.tokens.filter(t => q.filters.every(([c, v]) => t[c] === v)) : []
          return resolve({ data: rows, error: null })
        },
      }
      return api
    },
  }
  return { supabaseAdmin: () => db, requireUser: async () => state.user }
})
vi.mock('../api/_lib/emailPipeline.js', () => ({
  orderConnections: c => c,
  scanGmailConnection: async conn => {
    state.scanned.push(conn.connected_email)
    return conn.noKey
      ? { threadProgress: {}, cursor: null, scanned: 0, skipped: 'no_ai_key' }
      : { threadProgress: { t: 1 }, cursor: 'c', scanned: 3, pushes: [] }
  },
}))
vi.mock('../api/_lib/pushes.js', () => ({ runUserPushes: async () => ({ skipped: 'no_topic' }), pushSettingsFor: async () => null, sendPush: async () => true }))
vi.mock('../api/_lib/llm.js', () => ({ llmForUser: async () => null }))
vi.mock('../api/_lib/rateLimit.js', () => ({
  checkRateLimit: async (_u, tier) => ({ limited: tier === 'SCAN' && state.limited, retryAfter: 60 }),
  sendRateLimited: (res, retryAfter) => { res.setHeader('Retry-After', String(retryAfter)); res.status(429); res.end() },
}))

const { default: handler } = await import('../api/gmail.js')

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
  res.writeHead = (status) => { res.statusCode = status }
  res.end = (b = '') => { res.body = b }
  res.status = s => { res.statusCode = s; return res }
  res.json = b => { res.body = b; return res }
  return res
}
const scanMine = () => ({ method: 'POST', query: { action: 'scan-mine' }, headers: { host: 'app.example.com' } })

beforeEach(() => {
  state.user = { id: 'u1' }
  state.tokens = [
    { id: 1, user_id: 'u1', connected_email: 'me@x.com', last_scanned_at: null },
    { id: 2, user_id: 'u2', connected_email: 'other@x.com', last_scanned_at: null },
  ]
  state.updates = []; state.scanned = []; state.limited = false
})

describe('POST /api/gmail?action=scan-mine', () => {
  it('rejects a request with no session', async () => {
    state.user = null
    const res = mockRes()
    await handler(scanMine(), res)
    expect(res.statusCode).toBe(401)
    expect(state.scanned).toEqual([])
  })

  it('scans only the caller\'s own mailboxes and records the scan', async () => {
    const res = mockRes()
    await handler(scanMine(), res)
    expect(res.statusCode).toBe(200)
    expect(state.scanned).toEqual(['me@x.com'])
    expect(res.body.results).toEqual([expect.objectContaining({ email: 'me@x.com', scanned: 3 })])
    expect(state.updates[0].patch).toHaveProperty('last_scanned_at')
  })

  it('honors the per-mailbox cooldown so it never doubles up with the cron', async () => {
    state.tokens[0].last_scanned_at = new Date(Date.now() - 60000).toISOString()
    const res = mockRes()
    await handler(scanMine(), res)
    expect(state.scanned).toEqual([])
    expect(res.body.results[0]).toMatchObject({ email: 'me@x.com', skipped: 'cooldown' })
  })

  it('does not stamp last_scanned_at when the scan was skipped for want of a key', async () => {
    state.tokens[0].noKey = true
    const res = mockRes()
    await handler(scanMine(), res)
    expect(res.body.results[0]).toMatchObject({ skipped: 'no_ai_key' })
    expect(state.updates).toEqual([])
  })

  it('is rate limited on its own tier', async () => {
    state.limited = true
    const res = mockRes()
    await handler(scanMine(), res)
    expect(res.statusCode).toBe(429)
    expect(state.scanned).toEqual([])
  })
})
