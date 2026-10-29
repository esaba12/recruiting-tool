import { describe, it, expect, vi } from 'vitest'
import {
  statusPush, isFreshEnoughToPush, isQuietHours, localClock, digestSlot, combineUpdates, maxPriority,
  oaDigest, offerDigest, buildDigest, planPushes, sendPush, validTopic, awaitingReply, runUserPushes,
} from '../api/_lib/pushes.js'

const TZ = 'America/New_York'
// 2026-10-18 15:00 UTC = 11:00 EDT
const AT_11AM = new Date('2026-10-18T15:00:00Z').getTime()
const AT_3PM = new Date('2026-10-18T19:00:00Z').getTime()
const AT_11PM = new Date('2026-10-19T03:00:00Z').getTime()
const AT_MIDNIGHT = new Date('2026-10-19T04:10:00Z').getTime()

describe('statusPush (ported from the Apps Script buildStatusPush)', () => {
  it('builds the four update kinds and skips routine mail', () => {
    expect(statusPush({ type: 'OA_INVITE', company: 'Rippling', role: 'SWE Intern', oa_due_date: '2026-10-22', oa_link: 'https://hackerrank.com/x' }))
      .toEqual({ title: '🧪 OA received — Rippling', message: 'SWE Intern\nDue 2026-10-22\nhttps://hackerrank.com/x', priority: 'high', tags: ['test_tube'] })
    expect(statusPush({ type: 'INTERVIEW_INVITE', company: 'Stripe', interview_date: '2026-10-21' }))
      .toMatchObject({ title: '📞 Interview invite — Stripe', message: 'Scheduled 2026-10-21', priority: 'high' })
    expect(statusPush({ type: 'OFFER', company: 'Ramp', role: 'SWE Intern' })).toMatchObject({ title: '🎉 Offer — Ramp!', priority: 'urgent' })
    expect(statusPush({ type: 'REJECTION', company: null })).toMatchObject({ title: '❌ Rejected — Unknown company', message: 'Rejection received' })
    expect(statusPush({ type: 'OA_COMPLETED', company: 'Figma' })).toMatchObject({ priority: 'default' })
    expect(statusPush({ type: 'REPLY', company: 'Figma' })).toBeNull()
    expect(statusPush({ type: 'APPLICATION_CONFIRMATION', company: 'Figma' })).toBeNull()
  })
  it('says when an OA has no stated deadline', () => {
    expect(statusPush({ type: 'OA_INVITE', company: 'X' }).message).toBe('Online Assessment\nNo stated deadline — check the assessment page.')
  })
})

describe('timing', () => {
  it('only pushes mail from the last 2 days', () => {
    expect(isFreshEnoughToPush(new Date(AT_3PM - 86400000), AT_3PM)).toBe(true)
    expect(isFreshEnoughToPush(new Date(AT_3PM - 3 * 86400000), AT_3PM)).toBe(false)
  })
  it('reads the local hour and date in the user zone', () => {
    expect(localClock(AT_11PM, TZ)).toEqual({ hour: 23, date: '2026-10-18' })
    expect(localClock(AT_MIDNIGHT, TZ)).toEqual({ hour: 0, date: '2026-10-19' })
  })
  it('quiet hours run 22:00–08:00', () => {
    expect([21, 22, 3, 7, 8].map(h => isQuietHours(h))).toEqual([false, true, true, true, false])
  })
  it('digests at 11am and midnight only', () => {
    expect([11, 0, 12, 23].map(digestSlot)).toEqual(['am', 'midnight', null, null])
  })
})

describe('combining', () => {
  const q = [
    { title: 'A', message: 'a', priority: 'default', tags: [] },
    { title: 'B', message: 'b', priority: 'urgent', tags: [] },
  ]
  it('sends one queued update as is, and several as one push at the top priority', () => {
    expect(combineUpdates([q[0]])).toBe(q[0])
    expect(combineUpdates(q)).toEqual({ title: '📬 2 recruiting updates', message: 'A\nB', priority: 'urgent', tags: ['mailbox_with_mail'] })
    expect(maxPriority([{ priority: 'low' }, { priority: 'high' }])).toBe('high')
  })
})

describe('oaDigest', () => {
  it('lists every open OA with urgency in the priority', () => {
    const d = oaDigest([
      { company: 'Rippling', role: 'SWE Intern', oa_due_date: '2026-10-19' },
      { company: 'MongoDB', role: null, oa_due_date: '2026-10-16' },
    ], '2026-10-18')
    expect(d.lines).toEqual(['Rippling (SWE Intern) — due in 1d', 'MongoDB — overdue by 2d'])
    expect(d.priority).toBe('urgent')
    expect(oaDigest([], '2026-10-18')).toBeNull()
    expect(oaDigest([{ company: 'X', oa_due_date: '2026-10-28' }], '2026-10-18').priority).toBe('default')
  })
})

describe('offerDigest (v1.4 spec 02)', () => {
  it('lists offers due within 3 days, urgent the day before', () => {
    const d = offerDigest([
      { company: 'Ramp', role: 'SWE Intern', offer_deadline: '2026-10-19' },
      { company: 'Later', role: null, offer_deadline: '2026-10-25' },
      { company: 'Gone', role: null, offer_deadline: '2026-10-17' },
    ], '2026-10-18')
    expect(d.lines).toEqual(['Ramp (SWE Intern) — decide by tomorrow'])
    expect(d.priority).toBe('urgent')
    expect(offerDigest([{ company: 'X', offer_deadline: '2026-10-21' }], '2026-10-18')).toMatchObject({ lines: ['X — decide in 3d'], priority: 'high' })
    expect(offerDigest([{ company: 'X', offer_deadline: '2026-10-18' }], '2026-10-18').lines).toEqual(['X — decide today'])
    expect(offerDigest([], '2026-10-18')).toBeNull()
  })
  it('goes first in the digest', () => {
    const push = buildDigest({ slot: 'am', recap: null, oa: { lines: ['Rippling — due in 5d'], priority: 'default' }, offers: { lines: ['Ramp — decide today'], priority: 'urgent' } })
    expect(push.message).toBe('⚖️ Offer deadlines\nRamp — decide today\n\n⏰ Open OAs\nRippling — due in 5d')
    expect(push.priority).toBe('urgent')
  })
})

describe('buildDigest', () => {
  it('stacks recap, open OAs and held updates', () => {
    const push = buildDigest({
      slot: 'midnight',
      recap: { summary: 'Busy day.', todos: ['Reply to Kelly'] },
      oa: { lines: ['Rippling — due today'], priority: 'urgent' },
      updates: [{ title: '🎉 Offer — Ramp!', priority: 'urgent' }],
      click: 'https://app.example',
    })
    expect(push.title).toBe('🌙 Nightly recruiting digest')
    expect(push.message).toBe('Busy day.\n• Reply to Kelly\n\n⏰ Open OAs\nRippling — due today\n\n📬 Updates\n🎉 Offer — Ramp!')
    expect(push.priority).toBe('urgent')
    expect(push.click).toBe('https://app.example')
  })
  it('is null with nothing to say', () => {
    expect(buildDigest({ slot: 'am', recap: null, oa: null, updates: [] })).toBeNull()
  })
})

describe('planPushes (the per-tick schedule)', () => {
  const update = { title: '📞 Interview invite — Stripe', message: '', priority: 'high', tags: ['phone'] }

  it('flushes updates right away outside quiet hours', () => {
    expect(planPushes({ state: { queue: [] }, newPushes: [update], now: AT_3PM, timeZone: TZ }))
      .toEqual({ action: 'updates', queue: [update] })
  })
  it('holds updates during quiet hours', () => {
    expect(planPushes({ state: { queue: [] }, newPushes: [update], now: AT_11PM, timeZone: TZ }))
      .toEqual({ action: 'hold', queue: [update] })
  })
  it('sends the digest once per slot, carrying the queue', () => {
    const plan = planPushes({ state: { queue: [update], sentSlots: {} }, newPushes: [], now: AT_MIDNIGHT, timeZone: TZ })
    expect(plan).toEqual({ action: 'digest', slot: 'midnight', slotKey: '2026-10-19_midnight', queue: [update] })
    const again = planPushes({ state: { queue: [], sentSlots: { '2026-10-19_midnight': true } }, newPushes: [], now: AT_MIDNIGHT, timeZone: TZ })
    expect(again.action).toBe('none')
  })
  it('does nothing with nothing queued outside a digest hour', () => {
    expect(planPushes({ state: {}, newPushes: [], now: AT_3PM, timeZone: TZ }).action).toBe('none')
    expect(planPushes({ state: {}, newPushes: [], now: AT_11AM, timeZone: TZ }).action).toBe('digest')
  })
  it('caps the queue at 40', () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...update, title: `u${i}` }))
    expect(planPushes({ state: {}, newPushes: many, now: AT_11PM, timeZone: TZ }).queue).toHaveLength(40)
  })
})

describe('sendPush', () => {
  it('posts to the topic with ntfy headers', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const ok = await sendPush('my-topic', { title: 'T', message: 'M', priority: 'high', tags: ['phone'], click: 'https://x' }, { fetch, sleep: async () => {} })
    expect(ok).toBe(true)
    expect(fetch).toHaveBeenCalledWith('https://ntfy.sh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'my-topic', title: 'T', message: 'M', priority: 4, tags: ['phone'], click: 'https://x' }),
    })
  })
  it('retries three times, then gives up', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('Address unavailable'))
    expect(await sendPush('t', { title: 'T', message: 'M' }, { fetch, sleep: async () => {} })).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('never sends without a valid topic', async () => {
    const fetch = vi.fn()
    expect(await sendPush('', { title: 'T' }, { fetch })).toBe(false)
    expect(await sendPush('../admin', { title: 'T' }, { fetch })).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('validates topics like ntfy does', () => {
    expect(validTopic('recruiting-alex_42')).toBe(true)
    expect(validTopic('has space')).toBe(false)
    expect(validTopic('x'.repeat(65))).toBe(false)
  })
})

describe('awaitingReply (recap input, same rule as lib/attention.js)', () => {
  it('lists contacts whose last message was ours, 5+ days ago', () => {
    const now = AT_3PM
    const day = n => new Date(now - n * 86400000).toISOString().slice(0, 10)
    const contacts = [
      { id: 'a', name: 'Ann', company: 'X', status: '🟢 Warm', follow_up_date: null },
      { id: 'b', name: 'Bo', company: 'Y', status: '🟢 Warm', follow_up_date: null },
      { id: 'c', name: 'Cy', company: 'Z', status: '✅ Closed', follow_up_date: null },
    ]
    const interactions = [
      { contact_id: 'a', direction: 'Outbound', date: day(6) },
      { contact_id: 'b', direction: 'Outbound', date: day(2) },
      { contact_id: 'c', direction: 'Outbound', date: day(9) },
    ]
    expect(awaitingReply(contacts, interactions, now)).toEqual([{ name: 'Ann', company: 'X', days: 6 }])
  })
})

// Minimal stand-in for the service-role client: user_settings is a Map, every other table
// returns `rows[table]`. Chain methods return the builder; awaiting it yields { data }.
function fakeDb({ settings = {}, rows = {} } = {}) {
  const store = new Map(Object.entries(settings))
  const writes = []
  const db = {
    store, writes,
    from(table) {
      let key = null
      const b = {
        select: () => b, eq: (col, v) => { if (col === 'key') key = v; return b }, not: () => b, is: () => b,
        in: () => b, gte: () => b, order: () => b,
        maybeSingle: async () => ({ data: table === 'user_settings' && store.has(key) ? { value: store.get(key) } : null }),
        upsert: async (row) => { writes.push({ table, row }); if (table === 'user_settings') store.set(row.key, row.value); return { error: null } },
        then: (res, rej) => Promise.resolve({ data: rows[table] || [] }).then(res, rej),
      }
      return b
    },
  }
  return db
}

describe('runUserPushes', () => {
  const update = { title: '📞 Interview invite — Stripe', message: '', priority: 'high', tags: ['phone'] }
  const ok = () => vi.fn().mockResolvedValue({ ok: true, status: 200 })

  it('does nothing for a user without a topic', async () => {
    const db = fakeDb()
    expect(await runUserPushes(db, 'u1', [update], { now: AT_3PM, fetch: ok() })).toEqual({ skipped: 'no_topic' })
    expect(db.writes).toEqual([])
  })

  it('sends an update in the afternoon and empties the queue', async () => {
    const db = fakeDb({ settings: { push_settings: { ntfyTopic: 'alex-rec', timeZone: TZ } } })
    const fetch = ok()
    expect(await runUserPushes(db, 'u1', [update], { now: AT_3PM, fetch })).toEqual({ action: 'updates', queued: 0 })
    expect(JSON.parse(fetch.mock.calls[0][1].body).topic).toBe('alex-rec')
    expect(db.store.get('push_state').queue).toEqual([])
  })

  it('holds it at 11pm, then folds it into the midnight digest once', async () => {
    const db = fakeDb({
      settings: { push_settings: { ntfyTopic: 'alex-rec', timeZone: TZ } },
      rows: { applications: [{ company: 'Rippling', role: 'SWE Intern', oa_due_date: '2026-10-20' }] },
    })
    const fetch = ok()
    await runUserPushes(db, 'u1', [update], { now: AT_11PM, fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(db.store.get('push_state').queue).toHaveLength(1)

    await runUserPushes(db, 'u1', [], { now: AT_MIDNIGHT, fetch })
    expect(fetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetch.mock.calls[0][1].body).message
    expect(body).toContain('⏰ Open OAs\nRippling (SWE Intern) — due in 1d')
    expect(body).toContain('📬 Updates\n📞 Interview invite — Stripe')
    expect(db.store.get('push_state')).toEqual({ queue: [], sentSlots: { '2026-10-19_midnight': true } })

    await runUserPushes(db, 'u1', [], { now: AT_MIDNIGHT + 600000, fetch })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the queue and the slot open when ntfy is down', async () => {
    const db = fakeDb({ settings: { push_settings: { ntfyTopic: 'alex-rec', timeZone: TZ }, push_state: { queue: [update] } } })
    const fetch = vi.fn().mockRejectedValue(new Error('down'))
    await runUserPushes(db, 'u1', [], { now: AT_MIDNIGHT, fetch, sleep: async () => {} })
    expect(db.store.get('push_state')).toEqual({ queue: [update], sentSlots: {} })
  })
})
