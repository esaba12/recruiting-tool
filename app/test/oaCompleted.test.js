import { describe, it, expect, vi, afterEach } from 'vitest'
import { oaCompletedFields, pickOaApplication, oaInviteFields, OA_COMPLETED_RE, classifyEmail } from '../api/_lib/emailPipeline.js'

// v1.5 spec 07: OAs mark themselves done from the completion email (port from Apps Script).
describe('oaCompletedFields', () => {
  const receipt = { type: 'OA_COMPLETED' }
  it('closes an open OA, and nothing else', () => {
    expect(oaCompletedFields(receipt, { id: 'a', oa_completed: false })).toEqual({ oa_completed: true })
    expect(oaCompletedFields(receipt, { id: 'a', oa_completed: true })).toEqual({})
    expect(oaCompletedFields(receipt, null)).toEqual({})
    expect(oaCompletedFields({ type: 'OA_INVITE' }, { id: 'a', oa_completed: false })).toEqual({})
  })

  it('a later invite with a new link reopens it; the same link does not', () => {
    const done = { oa_completed: true, oa_link: 'https://hackerrank.com/a' }
    expect(oaInviteFields({ type: 'OA_INVITE', oa_link: 'https://hackerrank.com/b' }, done)).toMatchObject({ oa_completed: false })
    expect(oaInviteFields({ type: 'OA_INVITE', oa_link: 'https://hackerrank.com/a' }, done)).toEqual({})
  })
})

describe('pickOaApplication', () => {
  const rows = [
    { id: 'pm', role: 'PM Intern', oa_completed: false, oa_link: null, oa_due_date: null },
    { id: 'swe', role: 'SWE Intern', oa_completed: false, oa_link: 'https://codesignal.com/x', oa_due_date: null },
    { id: 'old', role: 'SWE Intern 2025', oa_completed: true, oa_link: 'https://codesignal.com/y' },
  ]
  it('prefers the role match when it has an open OA', () => {
    expect(pickOaApplication(rows, 'SWE Intern').id).toBe('swe')
  })
  it('falls back to the newest application at the company with an open OA', () => {
    expect(pickOaApplication(rows, 'PM Intern').id).toBe('swe')
    expect(pickOaApplication(rows, null).id).toBe('swe')
  })
  it('returns null when no OA is open, so a receipt never creates or touches an application', () => {
    expect(pickOaApplication([rows[0], rows[2]], null)).toBeNull()
    expect(pickOaApplication([], 'x')).toBeNull()
  })
})

describe('OA_COMPLETED_RE', () => {
  it('matches submission receipts, not invites', () => {
    expect(OA_COMPLETED_RE.test('Thank you for completing your assessment')).toBe(true)
    expect(OA_COMPLETED_RE.test('Your HackerRank test has been received')).toBe(true)
    expect(OA_COMPLETED_RE.test('Your assessment has been submitted')).toBe(true)
    expect(OA_COMPLETED_RE.test('Please complete the assessment by Friday')).toBe(false)
  })
})

describe('classifier prompt', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('offers OA_COMPLETED and passes the receipt hint through', async () => {
    let prompt = ''
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      prompt = JSON.parse(init.body).messages[0].content
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"type":"OA_COMPLETED"}' }] }) }
    }))
    await classifyEmail({ provider: 'anthropic', apiKey: 'k' }, {
      subject: 'Thanks', from: 'no-reply@hackerrank.com', body: 'Thank you for completing', date: '2026-11-11',
      extraHints: '\n\nlikely type OA_COMPLETED', profile: null,
    })
    expect(prompt).toMatch(/"type": "APPLICATION_CONFIRMATION\|OA_INVITE\|OA_COMPLETED\|/)
    expect(prompt).toMatch(/OA_COMPLETED means an automated receipt/)
    expect(prompt).toMatch(/likely type OA_COMPLETED/)
  })
})
