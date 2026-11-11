import { describe, it, expect } from 'vitest'
import { followUpSatisfied, followedUp, FOLLOW_UP_EARLY_DAYS } from '../src/lib/followUps.js'
import { overdueFollowUps, awaitingReply } from '../src/lib/attention.js'
import { followUpPatch, clearSentFollowUp } from '../api/_lib/emailPipeline.js'

// v1.5 spec 01: a follow-up you sent clears itself.
describe('followUpSatisfied', () => {
  const due = '2026-11-08'
  it(`counts a send from ${FOLLOW_UP_EARLY_DAYS} days before the due date onward`, () => {
    expect(followUpSatisfied(due, '2026-11-04')).toBe(false)
    expect(followUpSatisfied(due, '2026-11-05')).toBe(true)
    expect(followUpSatisfied(due, '2026-11-08')).toBe(true)
    expect(followUpSatisfied(due, '2026-11-20')).toBe(true)
  })
  it('accepts full ISO timestamps and needs both dates', () => {
    expect(followUpSatisfied(due, '2026-11-09T15:00:00.000Z')).toBe(true)
    expect(followUpSatisfied(null, '2026-11-09')).toBe(false)
    expect(followUpSatisfied(due, null)).toBe(false)
  })
  it('crosses month boundaries', () => {
    expect(followUpSatisfied('2026-12-02', '2026-11-29')).toBe(true)
    expect(followUpSatisfied('2026-12-02', '2026-11-28')).toBe(false)
  })
})

describe('followedUp / overdueFollowUps / awaitingReply', () => {
  const amara = { id: 'c1', name: 'Amara', status: '🟡 Cooling', followUpDate: '2020-01-08' }
  const ryan = { id: 'c2', name: 'Ryan', status: '🟡 Cooling', followUpDate: '2020-01-10' }
  const touch = (contactId, date, direction = 'Outbound', type = 'Email') => ({ contactId, date, direction, type })

  it('an outbound email after the due date takes the contact off the overdue list', () => {
    const interactions = [touch('c1', '2020-01-09')]
    expect(followedUp(amara, interactions)).toBe(true)
    expect(overdueFollowUps([amara, ryan], interactions).map(c => c.id)).toEqual(['c2'])
  })
  it("an inbound message, an 'Other' log, or a send long before the due date doesn't", () => {
    for (const i of [touch('c1', '2020-01-09', 'Inbound'), touch('c1', '2020-01-09', 'Outbound', 'Other'), touch('c1', '2019-12-20')]) {
      expect(overdueFollowUps([amara], [i]).map(c => c.id), JSON.stringify(i)).toEqual(['c1'])
    }
  })
  it('LinkedIn, calls and meetings count too', () => {
    for (const type of ['LinkedIn', 'Call', 'Meeting']) expect(followedUp(amara, [touch('c1', '2020-01-08', 'Outbound', type)])).toBe(true)
  })
  it('once followed up, the contact moves to Awaiting reply instead of disappearing', () => {
    const interactions = [touch('c1', '2020-01-09')]
    expect(awaitingReply([amara], interactions).map(x => x.contact.id)).toEqual(['c1'])
    // An unsent follow-up keeps the contact out of Awaiting reply, as before.
    expect(awaitingReply([ryan], [touch('c2', '2019-12-01')])).toEqual([])
  })
})

describe('followUpPatch (scan)', () => {
  const today = '2026-11-11'
  it('your own email that satisfies a due follow-up clears it, even if classified FOLLOW_UP_NEEDED', () => {
    expect(followUpPatch({ type: 'FOLLOW_UP_NEEDED' }, '2026-11-08', { fromMe: true, sentDay: today, today })).toEqual({ follow_up_date: null })
    expect(followUpPatch({ type: 'REPLY' }, '2026-11-08', { fromMe: true, sentDay: today, today })).toEqual({ follow_up_date: null })
  })
  it('your email well before a future follow-up leaves it alone', () => {
    expect(followUpPatch({ type: 'REPLY' }, '2026-11-30', { fromMe: true, sentDay: today, today })).toEqual({})
  })
  it('their email keeps the existing scheduling rule', () => {
    expect(followUpPatch({ type: 'FOLLOW_UP_NEEDED' }, '2026-11-08', { fromMe: false, sentDay: today, today })).toEqual({ follow_up_date: '2026-11-14' })
    expect(followUpPatch({ type: 'REPLY' }, '2026-11-08', { fromMe: false, sentDay: today, today })).toEqual({})
  })
  it('your email with no follow-up on file can still schedule one', () => {
    expect(followUpPatch({ type: 'FOLLOW_UP_NEEDED' }, null, { fromMe: true, sentDay: today, today })).toEqual({ follow_up_date: '2026-11-14' })
  })
})

describe('clearSentFollowUp (scan early-return path)', () => {
  function fakeDb(row) {
    const updates = []
    const db = { from: () => ({
      select: () => { const q = { eq: () => q, limit: () => Promise.resolve({ data: row ? [row] : [] }) }; return q },
      update: patch => { const q = { eq: () => q, then: r => { updates.push(patch); return Promise.resolve().then(r) } }; return q },
    }) }
    return { db, updates }
  }
  it('clears a satisfied follow-up', async () => {
    const { db, updates } = fakeDb({ id: 'c1', follow_up_date: '2026-11-08' })
    expect(await clearSentFollowUp(db, 'u1', 'amara@vercel.com', '2026-11-11')).toBe(true)
    expect(updates).toEqual([{ follow_up_date: null }])
  })
  it('leaves an unsatisfied one, an unknown contact and a missing email alone', async () => {
    for (const [row, email] of [[{ id: 'c1', follow_up_date: '2026-11-30' }, 'a@b.com'], [null, 'a@b.com'], [{ id: 'c1', follow_up_date: '2026-11-08' }, null]]) {
      const { db, updates } = fakeDb(row)
      expect(await clearSentFollowUp(db, 'u1', email, '2026-11-11')).toBe(false)
      expect(updates).toEqual([])
    }
  })
})
