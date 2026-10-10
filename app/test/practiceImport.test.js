import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
import {
  matchTopic, normalizeKind, normalizeOutcome, normalizeScore, parseMinutes, parsePracticeDate,
  parsePracticeCsv, validatePracticeItems, practicePrompt, draftsToLogs, practiceCsvTemplate, IMPORT_SOURCE,
} from '../src/lib/learning/practiceImport.js'

const TODAY = '2026-10-10'
const topics = [
  { id: 't-dcf', name: 'DCF', category: 'Valuation' },
  { id: 't-3s', name: 'Three statements', category: 'Accounting' },
  { id: 't-lbo', name: 'LBO model', category: 'Deals' },
  { id: 't-sizing', name: 'Market sizing', category: 'Case' },
  { id: 't-math', name: 'Mental math', category: 'Speed' },
]

describe('matchTopic', () => {
  it('matches exact, case-insensitive, and loose variants', () => {
    expect(matchTopic('DCF', topics)?.id).toBe('t-dcf')
    expect(matchTopic('three statements', topics)?.id).toBe('t-3s')
    expect(matchTopic('LBO', topics)?.id).toBe('t-lbo')
    expect(matchTopic('market-sizing drills', topics)?.id).toBe('t-sizing')
  })
  it('matches on strong word overlap (≥2 shared words) but not on one shared word', () => {
    const ib = [{ id: 'beh', name: 'Behavioral / why banking', category: 'Fit' }, { id: 'ev', name: 'Enterprise value vs equity value', category: 'Valuation' }]
    expect(matchTopic('Why banking story', ib)?.id).toBe('beh')
    expect(matchTopic('equity value bridge', ib)?.id).toBe('ev')
    expect(matchTopic('value investing book', ib)).toBeNull()
  })
  it('returns null rather than guessing', () => {
    expect(matchTopic('Behavioral', topics)).toBeNull()
    expect(matchTopic('', topics)).toBeNull()
  })
})

describe('field normalizers', () => {
  it('kind', () => {
    expect(normalizeKind('Mock interview')).toBe('mock')
    expect(normalizeKind('case with friend')).toBe('mock')
    expect(normalizeKind('HireVue')).toBe('assessment')
    expect(normalizeKind('OA')).toBe('assessment')
    expect(normalizeKind('LeetCode problem')).toBe('problem')
    expect(normalizeKind('reading')).toBe('session')
    expect(normalizeKind('')).toBe('session')
  })
  it('outcome', () => {
    expect(normalizeOutcome('Passed')).toBe('solved')
    expect(normalizeOutcome('needed hints')).toBe('hinted')
    expect(normalizeOutcome("couldn't solve")).toBe('failed')
    expect(normalizeOutcome('')).toBeNull()
  })
  it('score → 0–5 scale', () => {
    expect(normalizeScore('82%')).toBe(4.1)
    expect(normalizeScore('4/5')).toBe(4)
    expect(normalizeScore('7/10')).toBe(3.5)
    expect(normalizeScore('3')).toBe(3)
    expect(normalizeScore('8')).toBe(4)
    expect(normalizeScore('64')).toBe(3.2)
    expect(normalizeScore('n/a')).toBeNull()
    expect(normalizeScore('')).toBeNull()
  })
  it('minutes', () => {
    expect(parseMinutes('45')).toBe(45)
    expect(parseMinutes('45 min')).toBe(45)
    expect(parseMinutes('1h')).toBe(60)
    expect(parseMinutes('1.5 hours')).toBe(90)
    expect(parseMinutes('1:30')).toBe(90)
    expect(parseMinutes('')).toBeNull()
  })
  it('dates: ISO, US, month names, no year; never in the future', () => {
    expect(parsePracticeDate('2026-10-03', TODAY)).toBe('2026-10-03')
    expect(parsePracticeDate('10/3/2026', TODAY)).toBe('2026-10-03')
    expect(parsePracticeDate('10/3/26', TODAY)).toBe('2026-10-03')
    expect(parsePracticeDate('Oct 3, 2026', TODAY)).toBe('2026-10-03')
    expect(parsePracticeDate('October 3', TODAY)).toBe('2026-10-03')
    expect(parsePracticeDate('12/20', TODAY)).toBe('2025-12-20') // no year + would be future → last year
    expect(parsePracticeDate('2026-12-01', TODAY)).toBeNull()      // explicit future date: practice is past
    expect(parsePracticeDate('soon', TODAY)).toBeNull()
  })
})

describe('parsePracticeCsv', () => {
  const csv = [
    'Date,Topic,Type,Result,Minutes,Score,Notes',
    '10/1/2026,DCF,Mock interview,,45,4/5,"Missed WACC, nailed TV"',
    '2026-10-02,Market sizing,case with friend,,30,7/10,',
    'Oct 4,Behavioral,study,,20,,',
    ',DCF,study,,20,,no date',
    '2026-10-05,,,,,,',
  ].join('\n')

  it('maps header aliases into drafts, flags unmatched topics, counts skipped rows', () => {
    const { drafts, skipped, error } = parsePracticeCsv(csv, { topics, today: TODAY })
    expect(error).toBeUndefined()
    expect(drafts).toHaveLength(3)
    expect(skipped).toBe(2)
    expect(drafts[0]).toMatchObject({ date: '2026-10-01', kind: 'mock', topicIds: ['t-dcf'], minutes: 45, score: 4, notes: 'Missed WACC, nailed TV' })
    expect(drafts[1]).toMatchObject({ date: '2026-10-02', kind: 'mock', topicIds: ['t-sizing'], score: 3.5 })
    expect(drafts[2]).toMatchObject({ date: '2026-10-04', kind: 'session', topicIds: [], unmatchedTopic: 'Behavioral' })
  })

  it('accepts tab-separated rows pasted straight from a spreadsheet', () => {
    const { drafts } = parsePracticeCsv('Date\tTopic\tMinutes\n2026-10-01\tLBO\t60', { topics, today: TODAY })
    expect(drafts[0]).toMatchObject({ topicIds: ['t-lbo'], minutes: 60 })
  })

  it('keeps commas inside tab-separated cells (rows pasted from Sheets)', () => {
    const { drafts } = parsePracticeCsv('Date\tTopic\tNotes\n2026-10-01\tDCF\tMissed WACC inputs, TV solid', { topics, today: TODAY })
    expect(drafts[0].notes).toBe('Missed WACC inputs, TV solid')
  })

  it('errors on no date column or empty input', () => {
    expect(parsePracticeCsv('Topic,Minutes\nDCF,30', { topics, today: TODAY }).error).toMatch(/date/i)
    expect(parsePracticeCsv('', { topics, today: TODAY }).drafts).toEqual([])
  })
})

describe('validatePracticeItems (AI output)', () => {
  it('keeps only valid kinds/outcomes, maps topic names, drops undated or future items', () => {
    const parsed = { items: [
      { date: '2026-10-08', title: 'Mock with Jane', kind: 'mock', topics: ['DCF', 'LBO model'], score: 4, minutes: 50, notes: 'good' },
      { date: '2026-10-09', title: 'Zetamac', kind: 'drill', topics: ['Mental math'], score: '62' },
      { date: '2027-01-01', title: 'future', kind: 'mock', topics: ['DCF'] },
      { date: null, title: 'undated', kind: 'mock', topics: ['DCF'] },
      { date: '2026-10-07', title: 'x', kind: 'mock', topics: ['Made-up topic'], outcome: 'aced' },
    ] }
    const out = validatePracticeItems(parsed, { topics, today: TODAY, source: 'paste' })
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ kind: 'mock', topicIds: ['t-dcf', 't-lbo'], score: 4, minutes: 50 })
    expect(out[1]).toMatchObject({ kind: 'session', topicIds: ['t-math'], score: 3.1 })
    expect(out[2]).toMatchObject({ topicIds: [], unmatchedTopic: 'Made-up topic', outcome: null })
  })
  it('survives garbage', () => {
    expect(validatePracticeItems(null, { topics, today: TODAY })).toEqual([])
    expect(validatePracticeItems({ items: 'nope' }, { topics, today: TODAY })).toEqual([])
  })
  it('the prompt lists only the track topics and forbids inventing dates', () => {
    const p = practicePrompt({ trackName: 'IB', topics, today: TODAY })
    for (const t of topics) expect(p).toContain(t.name)
    expect(p).toMatch(/never invent/i)
  })
})

describe('draftsToLogs (idempotent re-import)', () => {
  const drafts = [
    { date: '2026-10-01', title: 'DCF mock', kind: 'mock', topicIds: ['t-dcf'], score: 4, minutes: 45, outcome: null, notes: '' },
    { date: '2026-10-01', title: 'DCF mock', kind: 'mock', topicIds: ['t-dcf'], score: 4, minutes: 45, outcome: null, notes: '' },
    { date: '2026-10-02', title: 'Sizing', kind: 'mock', topicIds: ['t-sizing'], score: 3.5, minutes: 30, outcome: null, notes: '' },
  ]
  it('gives every row a stable fingerprint under one import source', () => {
    const a = draftsToLogs(drafts, 'track-1')
    const b = draftsToLogs(structuredClone(drafts), 'track-1')
    expect(a.map(l => l.externalRef)).toEqual(b.map(l => l.externalRef))
    expect(a.every(l => l.source === IMPORT_SOURCE && l.trackId === 'track-1')).toBe(true)
  })
  it('two identical sessions on the same day stay two rows (occurrence index), not one', () => {
    const refs = draftsToLogs(drafts, 'track-1').map(l => l.externalRef)
    expect(new Set(refs).size).toBe(3)
  })
  it('notes edits do not change identity; a different date does', () => {
    const [x] = draftsToLogs([{ ...drafts[0], notes: 'edited' }], 'track-1')
    const [y] = draftsToLogs([drafts[0]], 'track-1')
    const [z] = draftsToLogs([{ ...drafts[0], date: '2026-10-03' }], 'track-1')
    expect(x.externalRef).toBe(y.externalRef)
    expect(z.externalRef).not.toBe(y.externalRef)
  })
  it('dates the log at local noon so it never slips a day', () => {
    const [l] = draftsToLogs([drafts[0]], 'track-1')
    const d = new Date(l.occurredAt)
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 10, 1])
  })
})

describe('practiceCsvTemplate', () => {
  it('has the expected header and an example row per topic category', () => {
    const t = practiceCsvTemplate(topics)
    const lines = t.trim().split('\n')
    expect(lines[0]).toBe('Date,Topic,Type,Result,Minutes,Score,Notes')
    expect(lines.length).toBeGreaterThan(1)
    const back = parsePracticeCsv(t, { topics, today: '2030-01-01' })
    expect(back.drafts.every(d => d.topicIds.length === 1)).toBe(true)
  })
})
