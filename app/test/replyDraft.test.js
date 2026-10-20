// v1.4 spec 10: which scanned emails get a drafted reply, what the drafter is told, and the
// free/busy lookup that feeds it call times.
import { describe, it, expect } from 'vitest'
import {
  shouldDraftReply, replyIntent, replySubject, stripQuoted, buildReplyPrompt, fetchBusy, slotsFor,
  MAX_DRAFTS_PER_RUN, DRAFT_FRESH_MS,
} from '../api/_lib/replyDraft.js'

const NOW = Date.parse('2026-10-19T12:00:00Z') // Mon 8am EDT
const ask = { type: 'REPLY', personal: true, needs_reply: true, reply_intent: 'schedule_call', summary: 'Recruiter wants to set up a call', next_action: 'Reply with times' }
const fresh = { fromMe: false, automatedSender: false, bulk: false, sentAt: new Date(NOW - 3600000), now: NOW }

describe('shouldDraftReply', () => {
  it('drafts a fresh personal email that needs an answer', () => {
    expect(shouldDraftReply(ask, fresh)).toBe(true)
  })

  it('skips anything that needs no reply or isn\'t personal', () => {
    expect(shouldDraftReply({ ...ask, needs_reply: false }, fresh)).toBe(false)
    expect(shouldDraftReply({ ...ask, needs_reply: 'true' }, fresh)).toBe(false) // only a real boolean
    expect(shouldDraftReply({ ...ask, personal: false }, fresh)).toBe(false)
    expect(shouldDraftReply({ type: 'UNRELATED' }, fresh)).toBe(false)
    expect(shouldDraftReply(null, fresh)).toBe(false)
  })

  it('never drafts for receipts, assessments or rejections', () => {
    for (const type of ['APPLICATION_CONFIRMATION', 'OA_INVITE', 'OA_COMPLETED', 'REJECTION']) {
      expect(shouldDraftReply({ ...ask, type }, fresh)).toBe(false)
    }
  })

  it('skips your own last message, automated senders and bulk mail', () => {
    expect(shouldDraftReply(ask, { ...fresh, fromMe: true })).toBe(false)
    expect(shouldDraftReply(ask, { ...fresh, automatedSender: true })).toBe(false)
    expect(shouldDraftReply(ask, { ...fresh, bulk: true })).toBe(false)
  })

  it('skips old mail from the first 45-day pass', () => {
    expect(shouldDraftReply(ask, { ...fresh, sentAt: new Date(NOW - DRAFT_FRESH_MS - 1) })).toBe(false)
  })

  it('respects the setting and the per-run cap', () => {
    expect(shouldDraftReply(ask, { ...fresh, enabled: false })).toBe(false)
    expect(shouldDraftReply(ask, { ...fresh, draftsThisRun: MAX_DRAFTS_PER_RUN })).toBe(false)
    expect(shouldDraftReply(ask, { ...fresh, draftsThisRun: MAX_DRAFTS_PER_RUN - 1 })).toBe(true)
  })
})

describe('small helpers', () => {
  it('replyIntent falls back to other', () => {
    expect(replyIntent(ask)).toBe('schedule_call')
    expect(replyIntent({ reply_intent: 'negotiate' })).toBe('other')
    expect(replyIntent(null)).toBe('other')
  })

  it('replySubject adds Re: once', () => {
    expect(replySubject('Coffee chat')).toBe('Re: Coffee chat')
    expect(replySubject('RE: Coffee chat')).toBe('RE: Coffee chat')
  })

  it('stripQuoted keeps only the new text', () => {
    expect(stripQuoted('Sounds good!\n\nOn Mon, Oct 19, 2026 at 9:00 AM Jane <j@x.com> wrote:\n> earlier\n> text')).toBe('Sounds good!')
    expect(stripQuoted('Hi\n> quoted\nThanks')).toBe('Hi\nThanks')
  })
})

describe('buildReplyPrompt', () => {
  const messages = [
    { from: 'You <me@school.edu>', date: new Date(NOW - 86400000), plainBody: 'Would love to chat about the internship.' },
    { from: 'Jane Recruiter <jane@acme.com>', date: new Date(NOW - 3600000), plainBody: 'Happy to! When are you free next week?\n\nOn Sun you wrote:\n> Would love to chat' },
  ]
  const base = { messages, myEmail: 'me@school.edu', data: ask, framing: 'a student recruiting for SWE roles', profile: { full_name: 'Alex Kim' }, timeZone: 'America/New_York' }
  const slots = [{ start: '2026-10-20T15:00:00Z', end: '2026-10-20T15:30:00Z' }]

  it('offers the given slots verbatim when scheduling', () => {
    const prompt = buildReplyPrompt({ ...base, slots })
    expect(prompt).toContain('Tue, Oct 20, 11:00 AM – 11:30 AM EDT')
    expect(prompt).toContain('Offer exactly these times')
  })

  it('asks them for times when availability is unknown, and never invents any', () => {
    const prompt = buildReplyPrompt(base)
    expect(prompt).toContain('ask them to suggest two or three times')
    expect(prompt).not.toContain('Offer exactly these times')
  })

  it('leaves scheduling out for other intents', () => {
    const prompt = buildReplyPrompt({ ...base, data: { ...ask, reply_intent: 'answer' }, slots })
    expect(prompt).not.toContain('Offer exactly these times')
    expect(prompt).not.toContain('suggest two or three times')
  })

  it('includes the résumé only when there is one, and signs with the first name', () => {
    expect(buildReplyPrompt({ ...base, resumeText: 'Built a compiler at State U' })).toContain('Built a compiler')
    expect(buildReplyPrompt(base)).not.toContain('résumé;')
    expect(buildReplyPrompt(base)).toContain('(Alex)')
  })

  it('labels your own messages and drops quoted history', () => {
    const prompt = buildReplyPrompt(base)
    expect(prompt).toContain('Candidate (you)')
    expect(prompt).not.toContain('> Would love to chat')
  })
})

describe('free/busy', () => {
  const okFetch = busy => async (url, init) => {
    expect(url).toBe('https://www.googleapis.com/calendar/v3/freeBusy')
    expect(JSON.parse(init.body).items).toEqual([{ id: 'primary' }])
    return { ok: true, json: async () => ({ calendars: { primary: { busy } } }) }
  }

  it('merges busy blocks across calendars and skips one that fails', async () => {
    const minted = []
    const mintToken = async rt => { minted.push(rt); if (rt === 'bad') throw new Error('revoked'); return `tok-${rt}` }
    const out = await fetchBusy({ refreshTokens: ['a', 'bad', 'b'], mintToken, timeMin: 'x', timeMax: 'y', fetch: okFetch([{ start: '2026-10-20T13:00:00Z', end: '2026-10-20T14:00:00Z' }]) })
    expect(minted).toEqual(['a', 'bad', 'b'])
    expect(out.checked).toBe(2)
    expect(out.busy).toHaveLength(2)
  })

  it('slotsFor: nothing without availability; unchecked without a calendar', async () => {
    const availability = { days: [1, 2, 3, 4, 5], start: 9, end: 18, slotMin: 30, timeZone: 'America/New_York' }
    expect(await slotsFor({ availability: null, refreshTokens: [], now: NOW })).toEqual({ slots: [], checked: false })
    const loose = await slotsFor({ availability, refreshTokens: [], now: NOW })
    expect(loose.slots).toHaveLength(3)
    expect(loose.checked).toBe(false)
  })

  it('slotsFor: avoids what the calendar says is busy', async () => {
    const availability = { days: [2], start: 9, end: 11, slotMin: 30, timeZone: 'America/New_York' }
    // Tue 9:00–10:30 EDT busy → only 10:30 is left that Tuesday
    const busy = [{ start: '2026-10-20T13:00:00Z', end: '2026-10-20T14:30:00Z' }]
    const { slots, checked } = await slotsFor({ availability, refreshTokens: ['a'], mintToken: async () => 't', now: NOW, fetch: okFetch(busy) })
    expect(checked).toBe(true)
    expect(slots[0].start).toBe('2026-10-20T14:30:00.000Z')
    for (const s of slots) expect(Date.parse(s.start)).toBeGreaterThanOrEqual(Date.parse('2026-10-20T14:30:00Z'))
  })
})
