import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseCompanyCsv, topicSlug, matchCompanyFolder, companyCoverage, companyTopicDemand, topicsForProblem, practicedSlugs,
} from '../src/lib/learning/companyProblems.js'
import { rankGaps } from '../src/lib/learning/mastery.js'
import { TEMPLATES } from '../src/lib/learning/templates.js'

const google = readFileSync(new URL('./fixtures/lc-company-google.csv', import.meta.url), 'utf8')
const stripe = readFileSync(new URL('./fixtures/lc-company-stripe.csv', import.meta.url), 'utf8')
const folders = JSON.parse(readFileSync(new URL('./fixtures/lc-company-folders.json', import.meta.url)))
const topics = TEMPLATES.swe.topics.map((t, i) => ({ ...t, id: `t${i}`, targetLevel: 3 }))

describe('parseCompanyCsv (captured dataset files)', () => {
  it('parses slugs, difficulty, frequency and topic slugs, most-asked first', () => {
    const g = parseCompanyCsv(google)
    expect(g.length).toBeGreaterThan(200)
    expect(g[0].frequency).toBeGreaterThanOrEqual(g[1].frequency)
    expect(g.every(p => /^[a-z0-9-]+$/.test(p.slug))).toBe(true)
    expect(new Set(g.map(p => p.difficulty))).toEqual(new Set(['Easy', 'Medium', 'Hard']))
    expect(g.some(p => p.tags.includes('hash-table'))).toBe(true)
    expect(parseCompanyCsv(stripe).length).toBeGreaterThan(5)
  })

  it('handles header-only and garbage input', () => {
    expect(parseCompanyCsv('Difficulty,Title,Frequency,Acceptance Rate,Link')).toEqual([])
    expect(parseCompanyCsv('')).toEqual([])
    expect(parseCompanyCsv('a,b\n1,2')).toEqual([])
  })

  it('slugifies LeetCode topic names the way LeetCode does', () => {
    expect(topicSlug('Heap (Priority Queue)')).toBe('heap-priority-queue')
    expect(topicSlug('Depth-First Search')).toBe('depth-first-search')
    expect(topicSlug('Hash Table')).toBe('hash-table')
  })

  it('every topic slug in the Google list that a SWE topic claims actually appears', () => {
    const tags = new Set(parseCompanyCsv(google).flatMap(p => p.tags))
    for (const t of ['two-pointers', 'sliding-window', 'binary-search', 'dynamic-programming', 'heap-priority-queue', 'breadth-first-search', 'trie']) {
      expect(tags.has(t), t).toBe(true)
    }
  })
})

describe('matchCompanyFolder', () => {
  it.each([
    ['Google', 'Google'], ['google llc', 'Google'], ['Meta', 'Meta'], ['Facebook', 'Meta'],
    ['JPMorgan Chase', 'J.P. Morgan'], ['JPMorgan', 'J.P. Morgan'], ['D. E. Shaw', 'DE Shaw'],
    ['Jane Street Capital', 'Jane Street'], ['Amazon Web Services', 'Amazon'], ['Two Sigma', 'Two Sigma'],
    ['Stripe, Inc.', 'Stripe'], ['Morgan Stanley', 'Morgan Stanley'],
  ])('%s → %s', (name, folder) => expect(matchCompanyFolder(name, folders)).toBe(folder))

  it('returns null rather than guessing', () => {
    expect(matchCompanyFolder('Some Tiny Startup Nobody Knows', folders)).toBeNull()
    expect(matchCompanyFolder('', folders)).toBeNull()
  })
})

describe('coverage + demand', () => {
  const problems = [
    { slug: 'a', title: 'A', frequency: 100, tags: ['array', 'dynamic-programming'] },
    { slug: 'b', title: 'B', frequency: 50, tags: ['array', 'hash-table'] },
    { slug: 'c', title: 'C', frequency: 50, tags: ['array'] },
  ]

  it('generic tags only count when nothing more specific matches', () => {
    const names = p => topicsForProblem(p, topics).map(t => t.name)
    expect(names(problems[0])).toEqual(['Dynamic programming'])
    expect(names(problems[2])).toEqual(['Arrays & hashing'])
  })

  it('weights coverage by frequency and lists the most-asked unsolved', () => {
    const cov = companyCoverage(problems, { solvedSlugs: new Set(['b']), attemptedSlugs: new Set(['a']), topics })
    expect(cov).toMatchObject({ total: 3, solved: 1, attempted: 1 })
    expect(cov.solvedFrequencyPct).toBeCloseTo(0.25)
    expect(cov.next.map(p => p.slug)).toEqual(['a', 'c'])
    expect(cov.topicShares[0].topic.name).toBe('Dynamic programming')
    expect(cov.topicShares[0].share).toBeCloseTo(0.5)
  })

  it('company topic mix reorders gaps and explains why', () => {
    const dp = topics.find(t => t.name === 'Dynamic programming')
    const trees = topics.find(t => t.name === 'Trees')
    const subset = [dp, trees].map(t => ({ ...t, weight: 1 }))
    const mastery = new Map(subset.map(t => [t.id, { level: 1, attempts: 3, verified: true, lastAt: new Date().toISOString() }]))
    const companyTopics = companyTopicDemand([{ company: 'Stripe', problems }], subset)
    const gaps = rankGaps(subset, mastery, { demand: { interviews: [{ company: 'Stripe' }], oas: [], companyTopics } })
    expect(gaps[0].topic.name).toBe('Dynamic programming')
    expect(gaps[0].reason).toMatch(/of Stripe's asked problems/)
    expect(gaps[1].reason).toMatch(/interviewing at Stripe/)
  })

  it('practicedSlugs splits accepted from attempted-only', () => {
    const items = [{ id: 1, source: 'leetcode', externalRef: 'a' }, { id: 2, source: 'leetcode', externalRef: 'b' }, { id: 3, source: 'manual', externalRef: 'manual:x' }]
    const logs = [{ itemId: 1, outcome: 'failed' }, { itemId: 1, outcome: 'hinted' }, { itemId: 2, outcome: 'failed' }, { itemId: 3, outcome: 'solved' }]
    const { solved, attempted } = practicedSlugs(items, logs)
    expect([...solved]).toEqual(['a'])
    expect([...attempted]).toEqual(['b'])
  })
})
