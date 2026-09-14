import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import localist, { classifyKind, extractEmployer, pickRegistrationUrl } from '../src/lib/ingest/adapters/localist.js'
import { sourcesFor, adapterFor } from '../src/lib/ingest/adapters/index.js'
import { dedupKey, findNearDuplicate, dedupWithin, titleSimilarity } from '../src/lib/ingest/dedup.js'
import { assessFreshness, isStale } from '../src/lib/ingest/freshness.js'
import { localToIso, tzOffsetMs, parseCompactLocal, wallClock } from '../src/lib/ingest/tz.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/umich-3172.json', import.meta.url), 'utf8'))
const ctx = { timezone: 'America/Detroit' }

describe('tz', () => {
  it('converts Detroit wall-clock to UTC across DST', () => {
    expect(localToIso({ y: 2026, m: 9, d: 14, hh: 10 }, 'America/Detroit')).toBe('2026-09-14T14:00:00.000Z')   // EDT −4
    expect(localToIso({ y: 2026, m: 12, d: 1, hh: 10 }, 'America/Detroit')).toBe('2026-12-01T15:00:00.000Z')   // EST −5
    expect(tzOffsetMs(Date.UTC(2026, 6, 1), 'Asia/Kolkata')).toBe(5.5 * 3600000)
    expect(wallClock(Date.UTC(2026, 8, 14, 14), 'America/Los_Angeles')).toMatchObject({ hh: 7, mm: 0 })
  })
  it('parses compact and dashed local timestamps', () => {
    expect(parseCompactLocal('20260914T100000')).toEqual({ y: 2026, m: 9, d: 14, hh: 10, mm: 0, ss: 0 })
    expect(parseCompactLocal('2026-09-14')).toEqual({ y: 2026, m: 9, d: 14, hh: 0, mm: 0, ss: 0 })
    expect(parseCompactLocal('nope')).toBeNull()
  })
})

describe('localist adapter — UMich ?v=2 fixture', () => {
  const { drafts, shape, rejected } = localist.normalize(fixture, ctx)
  it('detects the shape and normalizes every occurrence', () => {
    expect(shape).toBe('umich')
    expect(rejected).toBe(0)
    expect(drafts.length).toBe(fixture.length)
  })
  it('maps the SWE/TBP fair correctly', () => {
    const fair = drafts.find(d => /Fall Engineering Career Fair/.test(d.title) && d.startsAt.startsWith('2026-09-14'))
    expect(fair).toMatchObject({
      kind: 'career_fair', employerName: null, allDay: false, isVirtual: false,
      startsAt: '2026-09-14T14:00:00.000Z', endsAt: '2026-09-14T20:00:00.000Z',
      timezone: 'America/Detroit', location: 'Duderstadt Center', sourceKind: 'localist',
      sourceRef: '149606-21906757', url: 'https://events.umich.edu/event/149606', sourceHost: 'events.umich.edu',
    })
    expect(fair.registrationUrl).toBe('https://app.careerfairplus.com/ume_mi')
    expect(fair.dedupKey).toBe(dedupKey({ title: fair.title, employerName: null, startsAt: fair.startsAt }))
  })
  it('extracts the employer from "Career Cafe featuring X" but not from departmental Career Days', () => {
    const cafe = drafts.find(d => /Career Cafe featuring AbbVie/.test(d.title))
    expect(cafe).toMatchObject({ kind: 'info_session', employerName: 'AbbVie' })
    const day = drafts.find(d => /Department Career Day/.test(d.title))
    expect(day.kind).toBe('career_fair')
    expect(day.employerName).toBeNull()
  })
  it('classifies workshops', () => {
    expect(drafts.find(d => /Interview Essentials/.test(d.title)).kind).toBe('workshop')
    expect(drafts.find(d => /Headshot/.test(d.title)).kind).toBe('workshop')
  })
  it('every draft has a stable sourceRef and a dedupKey', () => {
    const refs = new Set(drafts.map(d => d.sourceRef))
    expect(refs.size).toBe(drafts.length)
    expect(drafts.every(d => d.dedupKey.split('|').length === 3)).toBe(true)
  })
})

describe('localist adapter — standard API v2 shape', () => {
  it('normalizes per instance with ISO+offset times', () => {
    const payload = { events: [{ event: {
      id: 55, title: 'Stripe Info Session', description_text: 'Come meet us', localist_url: 'https://calendar.school.edu/event/stripe',
      location_name: 'EECS 1200', url: 'https://stripe.com/students', ticket_url: 'https://school.joinhandshake.com/events/9',
      filters: { event_types: [{ name: 'Career' }] },
      event_instances: [{ event_instance: { id: 901, start: '2026-10-02T18:00:00-04:00', end: '2026-10-02T19:00:00-04:00', all_day: false } }],
    } }] }
    const { drafts, shape } = localist.normalize(payload, ctx)
    expect(shape).toBe('api2')
    expect(drafts[0]).toMatchObject({
      kind: 'info_session', employerName: 'Stripe', startsAt: '2026-10-02T22:00:00.000Z', sourceRef: '55-901',
      registrationUrl: 'https://school.joinhandshake.com/events/9', sourceHost: 'calendar.school.edu',
    })
  })
  it('returns nothing for an unrecognized payload (e.g. a Cloudflare challenge page)', () => {
    expect(localist.normalize('<!DOCTYPE html>', ctx)).toEqual({ drafts: [], shape: null, rejected: 0 })
    expect(localist.normalize({ foo: 1 }, ctx).drafts).toEqual([])
  })
})

describe('registry + sourcesFor', () => {
  it('builds runnable source descriptors from a school row', () => {
    const school = { feedConfig: { sources: [
      { kind: 'localist', base: 'https://events.umich.edu', groupId: 3172, label: 'ECRC' },
      { kind: 'handshake', base: 'https://umich.joinhandshake.com' },
      { kind: 'nope' },
    ] } }
    const s = sourcesFor(school)
    expect(s[0]).toMatchObject({ ref: '3172', url: 'https://events.umich.edu/group/3172/json?v=2', host: 'events.umich.edu', supported: true })
    expect(s[1].supported).toBe(false)
    expect(s[1].unsupported).toMatch(/SSO/)
    expect(s[2].supported).toBe(false)
    expect(adapterFor('localist').kind).toBe('localist')
  })
})

describe('helpers', () => {
  it('classifyKind + extractEmployer + pickRegistrationUrl', () => {
    expect(classifyKind('Anthropic Info Session')).toBe('info_session')
    expect(classifyKind('Coffee Chats with Figma PMs')).toBe('coffee_chat')
    expect(classifyKind('Ramp x UMich Alumni Mixer')).toBe('networking')
    expect(classifyKind('Something', 'Fair / Festival')).toBe('career_fair')
    expect(extractEmployer('Anthropic Info Session', 'info_session')).toBe('Anthropic')
    expect(extractEmployer('Engineering Career Cafe featuring Fifth Third Bank', 'info_session')).toBe('Fifth Third Bank')
    expect(extractEmployer('Career Cafe featuring AbbVie, Medtronic and RTX', 'info_session')).toBeNull()
    expect(pickRegistrationUrl([{ title: 'Career Fair Prep', url: 'https://x/prep' }, { title: 'Register', url: 'https://x/reg' }])).toBe('https://x/reg')
    expect(pickRegistrationUrl([], 'https://career.engin.umich.edu/')).toBeNull()
  })
})

describe('dedup', () => {
  const base = { title: 'Anthropic Info Session + Q&A', employerName: 'Anthropic', startsAt: '2026-10-05T22:00:00Z' }
  it('dedupKey is deterministic and normalizes punctuation/stopwords/hour bucket', () => {
    expect(dedupKey(base)).toBe(dedupKey({ ...base, title: 'the Anthropic info-session & Q&A', startsAt: '2026-10-05T22:40:00Z' }))
    expect(dedupKey(base)).not.toBe(dedupKey({ ...base, startsAt: '2026-10-05T23:00:00Z' }))
  })
  it('findNearDuplicate matches a contributed twin within ±60min with a near-identical title', () => {
    const existing = [{ id: 'e1', ...base }, { id: 'e2', title: 'Stripe Info Session', employerName: 'Stripe', startsAt: '2026-10-05T22:00:00Z' }]
    expect(findNearDuplicate({ title: 'Anthropic Info Session and Q&A', employerName: null, startsAt: '2026-10-05T22:05:00Z' }, existing)?.id).toBe('e1')
    expect(findNearDuplicate({ title: 'Anthropic Info Session', employerName: 'Anthropic', startsAt: '2026-10-06T00:00:00Z' }, existing)).toBeNull()  // 2h apart
    expect(findNearDuplicate({ title: 'Anthropic Info Session + Q&A', employerName: 'Stripe', startsAt: '2026-10-05T22:00:00Z' }, existing)).toBeNull() // different known employer
  })
  it('the two-day fair (same title, different days) stays two events; a repeated row collapses', () => {
    const { drafts } = localist.normalize(fixture, ctx)
    const fairs = drafts.filter(d => /Fall Engineering Career Fair/.test(d.title))
    expect(fairs.length).toBe(2)
    expect(dedupWithin([...drafts, drafts[0]]).length).toBe(drafts.length)
    expect(dedupWithin(drafts).length).toBe(drafts.length)
  })
  it('titleSimilarity', () => {
    expect(titleSimilarity('Fall Engineering Career Fair, hosted by SWE/TBP', 'Fall Engineering Career Fair')).toBeGreaterThan(0.5)
    expect(titleSimilarity('Stripe Info Session', 'Headshot Session')).toBeLessThan(0.5)
  })
})

describe('freshness gate', () => {
  const now = Date.parse('2026-09-14T12:00:00Z')
  const terms = [{ name: 'Fall 2026', start: '2026-08-10', end: '2026-12-31' }]
  it('accepts the live fixture', () => {
    const { drafts } = localist.normalize(fixture, ctx)
    expect(assessFreshness(drafts, terms, { now })).toMatchObject({ ok: true, stats: { total: 19, past: 0 } })
  })
  it('degrades a feed answering a 2026 query with 2023 data (the cached-stale-feed case)', () => {
    const stale = fixture.map(it => ({ ...it, datetime_start: it.datetime_start.replace(/^2026/, '2023'), datetime_end: it.datetime_end?.replace(/^2026/, '2023'), date_start: it.date_start.replace(/^2026/, '2023') }))
    const { drafts } = localist.normalize(stale, ctx)
    const verdict = assessFreshness(drafts, terms, { now })
    expect(verdict.ok).toBe(false)
    expect(verdict.reason).toMatch(/past-dated.*2023/)
  })
  it('degrades when nothing falls in a configured term; accepts empty feeds; flags undated', () => {
    expect(assessFreshness([{ startsAt: '2026-09-20T00:00:00Z' }], [{ name: 'W27', start: '2027-01-05', end: '2027-04-30' }], { now }).ok).toBe(false)
    expect(assessFreshness([], terms, { now }).ok).toBe(true)
    expect(assessFreshness([{ startsAt: 'garbage' }], terms, { now })).toMatchObject({ ok: false, reason: /no parseable dates/ })
    expect(assessFreshness([{ startsAt: '2026-09-20T00:00:00Z' }], [], { now }).ok).toBe(true)  // no term windows configured → only the date sanity checks apply
  })
  it('isStale is 14 days', () => {
    expect(isStale('2026-09-01T00:00:00Z', { now })).toBe(false)
    expect(isStale('2026-08-30T00:00:00Z', { now })).toBe(true)
    expect(isStale(null, { now })).toBe(true)
  })
})
