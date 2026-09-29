import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
vi.mock('../src/db.js', () => ({ upsertLearningItems: vi.fn(), importLearningLogs: vi.fn(), setUserSetting: vi.fn() }))
import { readFileSync } from 'node:fs'
import { buildLeetcodeRequest, MAX_SLUGS } from '../api/_lib/leetcode.js'
import { parseProfile, parseQuestions, resolveQuestionMeta, buildImport } from '../src/lib/learning/leetcodeImport.js'

const profileFixture = JSON.parse(readFileSync(new URL('./fixtures/leetcode-profile.json', import.meta.url)))
const questionsFixture = JSON.parse(readFileSync(new URL('./fixtures/leetcode-questions.json', import.meta.url)))

describe('buildLeetcodeRequest (proxy allowlist)', () => {
  it('builds the fixed profile query for a valid username', () => {
    const r = buildLeetcodeRequest({ op: 'profile', username: 'larryNY' })
    expect(r.variables).toEqual({ username: 'larryNY' })
    expect(r.query).toMatch(/recentAcSubmissionList/)
  })

  it('rejects bad usernames, unknown ops and client-supplied GraphQL', () => {
    const bad = [
      undefined, {}, { op: 'profile' }, { op: 'profile', username: 'a b' }, { op: 'profile', username: 'x'.repeat(41) },
      { op: 'profile', username: 'u", query: "{ x }' }, { op: 'raw', query: '{ allQuestions { title } }' },
      { query: '{ matchedUser(username:"x") { username } }' },
    ]
    for (const b of bad) {
      expect(() => buildLeetcodeRequest(b), JSON.stringify(b)).toThrow()
      try { buildLeetcodeRequest(b) } catch (e) { expect(e.status).toBe(400) }
    }
  })

  it('builds aliased question lookups only for valid slug lists', () => {
    const r = buildLeetcodeRequest({ op: 'questions', slugs: ['two-sum', 'lru-cache'] })
    expect(r.variables).toEqual({ s0: 'two-sum', s1: 'lru-cache' })
    expect(r.query).toMatch(/q1: question\(titleSlug: \$s1\)/)
    expect(() => buildLeetcodeRequest({ op: 'questions', slugs: [] })).toThrow()
    expect(() => buildLeetcodeRequest({ op: 'questions', slugs: Array(MAX_SLUGS + 1).fill('a') })).toThrow()
    expect(() => buildLeetcodeRequest({ op: 'questions', slugs: ['two-sum) { x }'] })).toThrow()
    expect(() => buildLeetcodeRequest({ op: 'questions', slugs: 'two-sum' })).toThrow()
  })
})

describe('parse + build import (captured real response)', () => {
  it('parses profile tag counts, difficulty and recent submissions', () => {
    const p = parseProfile(profileFixture)
    expect(p.username).toBeTruthy()
    expect(p.difficulty.All).toBeGreaterThan(0)
    expect(Object.keys(p.tagCounts).length).toBeGreaterThan(10)
    expect(p.recent).toHaveLength(20)
    expect(p.recent[0].timestamp).toBeGreaterThan(1.6e12)
  })

  it('throws a readable error for an unknown user', () => {
    expect(() => parseProfile({ errors: [{ message: 'That user does not exist.' }], data: { matchedUser: null } })).toThrow(/does not exist/)
  })

  it('parses aliased questions', () => {
    const m = parseQuestions(questionsFixture)
    expect(m.get('lru-cache')).toEqual({ title: 'LRU Cache', difficulty: 'Medium', tags: ['hash-table', 'linked-list', 'design', 'doubly-linked-list'] })
  })

  it('resolves from the bank first and only calls out for unknown slugs, fail-soft', async () => {
    const calls = []
    const call = async payload => { calls.push(payload); throw new Error('network down') }
    const meta = await resolveQuestionMeta(['two-sum', 'some-new-problem'], call)
    expect(calls).toEqual([{ op: 'questions', slugs: ['some-new-problem'] }])
    expect(meta.get('two-sum').difficulty).toBe('Easy')
    expect(meta.get('some-new-problem')).toEqual({ title: 'Some New Problem', difficulty: null, tags: [] })
  })

  it('dedupes items per slug but keeps one log per submission', async () => {
    const p = parseProfile(profileFixture)
    const meta = await resolveQuestionMeta(p.recent.map(r => r.slug), async () => ({ data: {} }))
    const { items, logs } = buildImport({ recent: p.recent, meta, trackId: 't1' })
    const uniqueSlugs = new Set(p.recent.map(r => r.slug)).size
    expect(items).toHaveLength(uniqueSlugs)
    expect(logs).toHaveLength(new Set(p.recent.map(r => r.id)).size)
    expect(logs.every(l => l.source === 'leetcode' && l.outcome === 'solved' && l.externalRef && l.trackId === 't1')).toBe(true)
  })
})

describe('template tags cover LeetCode profile tag vocabulary', async () => {
  const { TEMPLATES } = await import('../src/lib/learning/templates.js')
  it('every DSA-ish profile tag in the fixture used by a template maps to some topic', () => {
    const profileTags = new Set(Object.keys(parseProfile(profileFixture).tagCounts))
    const templateTags = new Set(TEMPLATES.swe.topics.flatMap(t => t.lcTags || []))
    for (const tag of ['heap', 'sweep-line', 'array', 'tree', 'graph', 'dynamic-programming', 'database']) {
      expect(profileTags.has(tag), tag).toBe(true)
      expect(templateTags.has(tag), tag).toBe(true)
    }
  })
})
