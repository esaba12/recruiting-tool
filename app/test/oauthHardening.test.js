// Callback hardening for the direct Google OAuth flows (Calendar + Gmail): HTML escaping on
// the error pages, and the browser-bound nonce that stops a state minted for one account
// from being completed in another person's browser.
import { describe, it, expect, beforeAll, vi } from 'vitest'

beforeAll(() => {
  if (!/^[0-9a-f]{64}$/i.test(process.env.SECRET_ENCRYPTION_KEY || '')) {
    process.env.SECRET_ENCRYPTION_KEY = 'a'.repeat(64)
  }
})

function mockRes() {
  const res = { statusCode: 200, headers: {}, body: '' }
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v }
  res.writeHead = (status, h = {}) => { res.statusCode = status; for (const [k, v] of Object.entries(h)) res.setHeader(k, v) }
  res.end = (b = '') => { res.body = b }
  res.status = (s) => { res.statusCode = s; return res }
  res.json = (b) => { res.body = JSON.stringify(b); return res }
  return res
}
const req = (query, cookie) => ({ query, method: 'GET', headers: { host: 'app.example.com', 'x-forwarded-proto': 'https', ...(cookie ? { cookie } : {}) } })

describe('escapeHtml', () => {
  it('neutralizes markup', async () => {
    const { escapeHtml } = await import('../api/_lib/googleOAuth.js')
    expect(escapeHtml('<script>alert("x")</script>&\'')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;')
  })
})

describe('OAuth nonce', () => {
  it('issues an HttpOnly, Secure, SameSite=Lax cookie scoped to /api', async () => {
    const { issueOAuthNonce } = await import('../api/_lib/googleOAuth.js')
    const res = mockRes()
    const nonce = issueOAuthNonce(req({}), res, 'gmail_oauth_nonce')
    expect(nonce).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(res.headers['set-cookie']).toMatch(/^gmail_oauth_nonce=.+; Path=\/api; HttpOnly; SameSite=Lax; Max-Age=600; Secure$/)
  })

  it('accepts only the matching cookie, and always clears it', async () => {
    const { consumeOAuthNonce } = await import('../api/_lib/googleOAuth.js')
    let res = mockRes()
    expect(consumeOAuthNonce(req({}, 'gmail_oauth_nonce=abc'), res, 'gmail_oauth_nonce', 'abc')).toBe(true)
    expect(res.headers['set-cookie']).toMatch(/Max-Age=0/)
    expect(consumeOAuthNonce(req({}, 'gmail_oauth_nonce=abd'), mockRes(), 'gmail_oauth_nonce', 'abc')).toBe(false)
    expect(consumeOAuthNonce(req({}), mockRes(), 'gmail_oauth_nonce', 'abc')).toBe(false)
    expect(consumeOAuthNonce(req({}, 'gmail_oauth_nonce=abc'), mockRes(), 'gmail_oauth_nonce', undefined)).toBe(false)
  })
})

describe.each([
  ['calendar', '../api/google-oauth-callback.js', 'gcal_oauth_nonce', { slot: 'personal' }],
  ['gmail', '../api/gmail.js', 'gmail_oauth_nonce', {}],
])('%s callback', (_name, modPath, cookieName, extra) => {
  it('escapes a crafted ?error= instead of rendering it', async () => {
    const { default: handler } = await import(modPath)
    const res = mockRes()
    await handler(req({ error: '<img src=x onerror=alert(1)>' }), res)
    expect(res.statusCode).toBe(400)
    expect(res.body).not.toContain('<img')
    expect(res.body).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('refuses a valid state completed in a browser without the matching nonce cookie', async () => {
    const { encrypt } = await import('../api/_lib/crypto.js')
    const { default: handler } = await import(modPath)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const state = encrypt(JSON.stringify({ userId: 'attacker', nonce: 'attacker-nonce', exp: Date.now() + 60_000, ...extra }))
    for (const cookie of [undefined, `${cookieName}=victim-nonce`]) {
      const res = mockRes()
      await handler(req({ code: 'c', state }, cookie), res)
      expect(res.statusCode).toBe(400)
      expect(res.body).toContain('started from this browser')
    }
    expect(fetchSpy).not.toHaveBeenCalled() // never reached the token exchange
    fetchSpy.mockRestore()
  })

  it('lets the legitimate browser (matching cookie) through to the token exchange', async () => {
    const { encrypt } = await import('../api/_lib/crypto.js')
    const { default: handler } = await import(modPath)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    const state = encrypt(JSON.stringify({ userId: 'u', nonce: 'n1', exp: Date.now() + 60_000, ...extra }))
    const res = mockRes()
    await handler(req({ code: 'c', state }, `${cookieName}=n1`), res)
    expect(fetchSpy).toHaveBeenCalledWith('https://oauth2.googleapis.com/token', expect.anything())
    expect(res.statusCode).toBe(502) // our mocked Google rejected the code — but the nonce gate was passed
    fetchSpy.mockRestore()
  })

  it('refuses a legacy state with no nonce at all', async () => {
    const { encrypt } = await import('../api/_lib/crypto.js')
    const { default: handler } = await import(modPath)
    const state = encrypt(JSON.stringify({ userId: 'u', exp: Date.now() + 60_000, ...extra }))
    const res = mockRes()
    await handler(req({ code: 'c', state }, `${cookieName}=anything`), res)
    expect(res.statusCode).toBe(400)
  })
})

describe('gmail scan cron secret', () => {
  it('rejects a missing or wrong secret', async () => {
    const prev = process.env.CRON_SECRET
    process.env.CRON_SECRET = 'right-secret'
    const { default: handler } = await import('../api/gmail.js')
    for (const h of [{}, { 'x-cron-secret': 'wrong' }, { 'x-cron-secret': 'right-secreT' }]) {
      const res = mockRes()
      await handler({ method: 'POST', query: {}, headers: h }, res)
      expect(res.statusCode).toBe(401)
    }
    process.env.CRON_SECRET = prev
  })
})
