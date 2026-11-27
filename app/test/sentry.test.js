import { describe, it, expect } from 'vitest'
import { scrubEvent, scrubBreadcrumb, DATA_COLLECTION } from '../src/lib/sentry.js'

describe('sentry scrubbing', () => {
  it('drops request bodies, headers, cookies, and query strings; keeps only the user id', () => {
    const e = scrubEvent({
      request: { url: 'https://x.app/api/gmail?code=secret&email=a@b.com', data: '{"apiKey":"sk-ant-x"}', headers: { Authorization: 'Bearer t' }, cookies: 'c', query_string: 'code=secret' },
      user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4' },
    })
    expect(e.request).toEqual({ url: 'https://x.app/api/gmail' })
    expect(e.user).toEqual({ id: 'u1' })
  })
  it('drops console and /api/keys breadcrumbs and strips query strings from the rest', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'leak' })).toBeNull()
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: '/api/keys', method: 'POST' } })).toBeNull()
    expect(scrubBreadcrumb({ category: 'fetch', data: { url: '/api/gmail?email=a@b.com', method: 'DELETE' } }).data.url).toBe('/api/gmail')
    expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/?code=x', to: '/' } }).data).toEqual({ from: '/', to: '/' })
  })
})

// Sentry v11 collects user info, cookies, headers, bodies and query params unless told not to
// (v10 didn't). Everything stays off; beforeSend/beforeBreadcrumb remain the backstop.
describe('DATA_COLLECTION (Sentry v11 defaults)', () => {
  it('turns every collection default off', () => {
    expect(DATA_COLLECTION).toEqual({
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false }, databaseQueryData: false,
    })
  })
})

describe('scrubBreadcrumb still drops v11 console breadcrumbs', () => {
  it('drops the consoleIntegration shape', () => {
    expect(scrubBreadcrumb({ category: 'console', level: 'error', message: 'sk-ant-secret', data: { arguments: ['sk-ant-secret'], logger: 'console' } })).toBeNull()
  })
})
