import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/ai.js', () => ({ aiJSON: vi.fn(), AI_MODELS: { MINI: 'mini', STANDARD: 'std' } }))
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { parseIcs, parseCsv, manualDraft, extractFromPaste } = await import('../src/lib/eventImport.js')
const { aiJSON } = await import('../src/lib/ai.js')
const { validateContribution, gateVisibility, annotateDuplicates, SHARE_CONFIDENCE } = await import('../src/lib/ingest/contribute.js')

const TZ = 'America/Detroit'

describe('parseIcs', () => {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:abc-1@handshake', 'SUMMARY:Stripe Info Session', 'DTSTART;TZID=America/Detroit:20261002T180000', 'DTEND;TZID=America/Detroit:20261002T190000',
    'LOCATION:EECS 1200', 'DESCRIPTION:Meet the infra team\\, pizza provided.\\nRSVP required', 'URL:https://umich.joinhandshake.com/events/9', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:day', 'SUMMARY:Fall Career Fair (all day', ' )', 'DTSTART;VALUE=DATE:20261005', 'DTEND;VALUE=DATE:20261006', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:z', 'SUMMARY:Coffee chat with Figma', 'DTSTART:20261007T150000Z', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:nodate', 'SUMMARY:Broken', 'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  it('parses TZID, all-day (folded line), Zulu; skips undated; unescapes text', () => {
    const d = parseIcs(ics, { timezone: TZ })
    expect(d.length).toBe(3)
    expect(d[0]).toMatchObject({ title: 'Stripe Info Session', kind: 'info_session', employerName: 'Stripe', startsAt: '2026-10-02T22:00:00.000Z', endsAt: '2026-10-02T23:00:00.000Z', sourceKind: 'ics', sourceRef: 'abc-1@handshake', confidence: 0.95, location: 'EECS 1200' })
    expect(d[0].description).toBe('Meet the infra team, pizza provided.\nRSVP required')
    expect(d[1]).toMatchObject({ title: 'Fall Career Fair (all day)', kind: 'career_fair', allDay: true, startsAt: '2026-10-05T04:00:00.000Z' })
    expect(d[2]).toMatchObject({ kind: 'coffee_chat', employerName: 'Figma', startsAt: '2026-10-07T15:00:00.000Z', allDay: false })
  })
})

describe('parseCsv', () => {
  it('maps aliased headers, quoted cells, tabs; skips rows without title/date', () => {
    const csv = 'Event Name,Date,End,Where,Company,Link\n"Anthropic Info Session, Q&A",2026-10-03 18:00,2026-10-03 19:30,BBB 1670,Anthropic,https://x/a\nBroken,,,\nCareer Cafe featuring RTX,10/06/2026 11:00 AM,,Career Center,,\n'
    const { drafts, skipped, mapping } = parseCsv(csv, { timezone: TZ })
    expect(mapping).toMatchObject({ title: 0, start: 1, end: 2, location: 3, employer: 4, url: 5 })
    expect(skipped).toBe(1)
    expect(drafts[0]).toMatchObject({ title: 'Anthropic Info Session, Q&A', employerName: 'Anthropic', startsAt: '2026-10-03T22:00:00.000Z', endsAt: '2026-10-03T23:30:00.000Z', sourceKind: 'csv', confidence: 0.9, url: 'https://x/a' })
    expect(drafts[1]).toMatchObject({ kind: 'info_session', employerName: 'RTX' })
    expect(drafts[1].startsAt).toMatch(/^2026-10-06T/)
  })
  it('errors without a title + date column', () => {
    expect(parseCsv('a,b\n1,2', { timezone: TZ }).error).toMatch(/title/)
  })
})

describe('extractFromPaste', () => {
  it('turns model output into drafts in the campus zone, clamps confidence, keeps stated requirements', async () => {
    aiJSON.mockResolvedValueOnce({ items: [
      { title: 'Ramp Tech Talk', kind: 'info_session', employer: 'Ramp', start: '2026-10-08T17:30', end: '2026-10-08T18:30', location: 'Ross', virtual: false, url: null, registration_url: 'https://umich.joinhandshake.com/events/12', description: 'Talk', confidence: 1.7,
        requirements: [{ kind: 'register', label: 'RSVP on Handshake', url: 'https://umich.joinhandshake.com/events/12', due: '2026-10-07', required: true }] },
      { title: 'No date', start: null },
    ] })
    const d = await extractFromPaste('…', { timezone: TZ })
    expect(d.length).toBe(1)
    expect(d[0]).toMatchObject({ title: 'Ramp Tech Talk', employerName: 'Ramp', startsAt: '2026-10-08T21:30:00.000Z', sourceKind: 'paste', confidence: 1 })
    expect(d[0].requirements[0].kind).toBe('register')
  })
})

describe('contribution validation + confidence gate + dedup', () => {
  it('validateContribution normalizes and rejects junk', () => {
    expect(validateContribution({ title: '', startsAt: '2026-10-01T00:00:00Z' }).ok).toBe(false)
    expect(validateContribution({ title: 'x', startsAt: 'nope' }).ok).toBe(false)
    const v = validateContribution({ title: '  Fair  ', startsAt: '2026-10-01T14:00:00Z', endsAt: '2026-10-01T12:00:00Z', kind: 'bogus', sourceKind: 'paste', confidence: 4, url: 'javascript:x', registrationUrl: 'https://ok/r' })
    expect(v.ok).toBe(true)
    expect(v.draft).toMatchObject({ title: 'Fair', kind: 'other', endsAt: null, confidence: 1, url: null, registrationUrl: 'https://ok/r', sourceKind: 'paste' })
    expect(validateContribution({ title: 'm', startsAt: '2026-10-01T14:00:00Z' }).draft).toMatchObject({ sourceKind: 'manual', confidence: 1 })
    expect(validateContribution({ title: 'p', startsAt: '2026-10-01T14:00:00Z', sourceKind: 'paste', confidence: 'abc' }).draft.confidence).toBe(0.5)
  })
  it('gateVisibility: below threshold or unshared stays private', () => {
    expect(gateVisibility({ confidence: SHARE_CONFIDENCE }, { share: true }).visibility).toBe('shared')
    expect(gateVisibility({ confidence: 0.79 }, { share: true })).toMatchObject({ visibility: 'private', reason: /below/ })
    expect(gateVisibility({ confidence: 1 }, { share: false }).visibility).toBe('private')
  })
  it('annotateDuplicates flags a contributed twin of a pool event', () => {
    const pool = [{ id: 'p1', title: 'Anthropic Info Session + Q&A', startsAt: '2026-10-05T22:00:00Z', attributes: { employer: 'Anthropic' } }]
    const d = manualDraft({ title: 'Anthropic Info Session', start: '2026-10-05T18:10', employerName: 'Anthropic', timezone: TZ })
    expect(annotateDuplicates([d], pool)[0].duplicateOf?.id).toBe('p1')
    const far = manualDraft({ title: 'Anthropic Info Session', start: '2026-10-06T18:00', timezone: TZ })
    expect(annotateDuplicates([far], pool)[0].duplicateOf).toBeNull()
  })
})
