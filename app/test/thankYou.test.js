import { describe, it, expect, vi } from 'vitest'
import { thankYouDue, todayPeople } from '../src/lib/attention.js'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { thankYouTemplate, buildDraftPrompt } = await import('../src/lib/drafting.js')

// 2026-10-28 15:00 local
const now = new Date(2026, 9, 28, 15).getTime()
const at = (day, hour) => new Date(2026, 9, day, hour).toISOString()
const day = d => `2026-10-${String(d).padStart(2, '0')}`

const kelly = { id: 'c1', name: 'Kelly Sanders', company: 'Stripe', status: '🟢 Warm' }
const deepak = { id: 'c2', name: 'Deepak Nair', company: 'Anthropic ', status: '🟢 Warm' }
const stripe = { id: 'a1', company: 'Stripe', role: 'SWE Intern', stage: 'Technical', interviewAt: at(27, 14), interviewTimeKnown: true }

describe('thankYouDue (v1.4 spec 03)', () => {
  it('an interview in the last 48h, with the contact at that company', () => {
    const rows = thankYouDue([stripe], [kelly], [], { now })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'interview:a1', kind: 'interview', app: stripe, contact: kelly })
  })

  it('in window vs out of window', () => {
    const old = { ...stripe, interviewAt: at(25, 14) }        // 3 days ago
    const upcoming = { ...stripe, interviewAt: at(28, 17) }   // later today
    expect(thankYouDue([old], [kelly], [], { now })).toEqual([])
    expect(thankYouDue([upcoming], [kelly], [], { now })).toEqual([])
    expect(thankYouDue([{ ...stripe, stage: 'Rejected' }], [kelly], [], { now })).toEqual([])
  })

  it('an outbound after the interview clears it; one before it does not', () => {
    const before = { id: 'i1', contactId: 'c1', type: 'Email', direction: 'Outbound', date: day(26) }
    const after = { id: 'i2', contactId: 'c1', type: 'Email', direction: 'Outbound', date: day(27), sentAt: at(27, 18) }
    const sameDayEarlier = { ...after, id: 'i3', sentAt: at(27, 9) }
    expect(thankYouDue([stripe], [kelly], [before], { now })).toHaveLength(1)
    expect(thankYouDue([stripe], [kelly], [sameDayEarlier], { now })).toHaveLength(1)
    expect(thankYouDue([stripe], [kelly], [after], { now })).toEqual([])
    // Logged by hand (date only) on or after the interview day counts.
    expect(thankYouDue([stripe], [kelly], [{ ...before, date: day(28) }], { now })).toEqual([])
  })

  it('matches the company by normalizeCompanyName', () => {
    const app = { ...stripe, id: 'a2', company: 'anthropic' }
    expect(thankYouDue([app], [deepak], [], { now })[0].contact).toBe(deepak)
    const thanked = { id: 'i4', contactId: 'c2', type: 'LinkedIn', direction: 'Outbound', date: day(28) }
    expect(thankYouDue([app], [deepak], [thanked], { now })).toEqual([])
  })

  it('an interview with nobody on file at the company still shows, with no contact', () => {
    expect(thankYouDue([stripe], [], [], { now })[0]).toMatchObject({ kind: 'interview', contact: null })
  })

  it('a call or meeting in the last two days, until you write to them', () => {
    const call = { id: 'i5', contactId: 'c2', type: 'Call', direction: 'Outbound', date: day(27), summary: 'Talked about the infra team' }
    const rows = thankYouDue([], [deepak], [call], { now })
    expect(rows).toEqual([expect.objectContaining({ id: 'call:i5', kind: 'conversation', contact: deepak, interaction: call })])
    expect(thankYouDue([], [deepak], [{ ...call, date: day(25) }], { now })).toEqual([])
    expect(thankYouDue([], [deepak], [call, { id: 'i6', contactId: 'c2', type: 'Email', direction: 'Outbound', date: day(27) }], { now })).toEqual([])
    expect(thankYouDue([], [deepak], [call, { id: 'i7', contactId: 'c2', type: 'Email', direction: 'Outbound', date: day(26) }], { now })).toHaveLength(1)
    // An inbound email isn't a thank-you.
    expect(thankYouDue([], [deepak], [call, { id: 'i8', contactId: 'c2', type: 'Email', direction: 'Inbound', date: day(28) }], { now })).toHaveLength(1)
  })

  it('one row per person: the interview wins over a call with the same contact', () => {
    const call = { id: 'i9', contactId: 'c1', type: 'Call', direction: 'Outbound', date: day(27) }
    const rows = thankYouDue([stripe], [kelly], [call], { now })
    expect(rows.map(r => r.id)).toEqual(['interview:a1'])
  })
})

describe('todayPeople with thank-yous', () => {
  it('a contact in Thank-you and Awaiting reply only shows in Thank-you', () => {
    const contact = { id: 'c3', name: 'Sofia', company: 'Figma', status: '🟢 Warm' }
    const interactions = [
      { id: 'e1', contactId: 'c3', type: 'Email', direction: 'Outbound', date: day(20) },
      { id: 'm1', contactId: 'c3', type: 'Meeting', direction: 'N/A', date: day(28) },
    ]
    // The meeting is newer than the email, so awaitingReply needs the older outbound to be last…
    const lists = todayPeople([contact], [interactions[0]], { apps: [], now, awaitingDays: 5 })
    expect(lists.awaiting.map(x => x.contact.id)).toEqual(['c3'])
    // …and once a call lands, it moves to Thank-you instead of showing twice.
    const app = { id: 'a9', company: 'Figma', role: 'PM Intern', stage: 'Onsite', interviewAt: at(28, 10) }
    const both = todayPeople([contact], [interactions[0]], { apps: [app], now, awaitingDays: 5 })
    expect(both.thankYou.map(x => x.contact.id)).toEqual(['c3'])
    expect(both.awaiting).toEqual([])
  })
})

describe('thank-you drafts', () => {
  it('a template that works with no key', () => {
    const t = thankYouTemplate({ contact: kelly, app: stripe })
    expect(t).toContain('Hi Kelly')
    expect(t).toContain('SWE Intern')
    expect(thankYouTemplate({ contact: null, app: stripe })).toMatch(/^Hi there/)
    expect(thankYouTemplate({ contact: deepak, interaction: { type: 'Call', summary: 'x' } })).toContain('call')
  })
  it('the AI prompt carries what happened', () => {
    const p = buildDraftPrompt({ contact: kelly, kind: 'thank_you', personalizationContext: 'Technical interview for SWE Intern', profile: null })
    expect(p).toContain('thank-you')
    expect(p).toContain('Technical interview for SWE Intern')
  })
})
