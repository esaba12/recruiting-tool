import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
vi.mock('../src/db.js', () => ({ upsertLearningItems: vi.fn(), importLearningLogs: vi.fn(), setUserSetting: vi.fn(), updateLearningItem: vi.fn() }))
import { readFileSync } from 'node:fs'
import { buildLeetcodeRequest, leetcodeHeaders, MAX_SLUGS, HISTORY_PAGE } from '../api/_lib/leetcode.js'
import {
  parseProfile, parseQuestions, resolveQuestionMeta, buildImport, summarizeAttempts, attemptOutcome, reviewUpdates, IN_PROGRESS_MS,
  mergeLanguageStats, parseHistoryPage, buildHistoryImport, importLeetcodeHistory,
} from '../src/lib/learning/leetcodeImport.js'
import * as db from '../src/db.js'

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

describe('struggle-aware import (any-status submissions)', () => {
  const p = parseProfile(profileFixture)
  const H = 3600000
  const sub = (id, slug, t, status = 'Accepted') => ({ id: String(id), slug, title: slug, timestamp: t, status })

  it('parses the any-status list with statuses', () => {
    expect(p.submissions).toHaveLength(20)
    expect(new Set(p.submissions.map(s => s.status)).has('Wrong Answer')).toBe(true)
  })

  it('counts failed submissions before each accept from the real capture', () => {
    const a = summarizeAttempts(p.recent, p.submissions, Date.now())
    const by = slug => a.find(x => x.slug === slug && !x.failed)
    expect(by('check-if-there-is-a-valid-parentheses-string-path').wrong).toBe(1)
    expect(by('check-if-there-is-a-valid-parentheses-string-path').statuses).toEqual(['Wrong Answer'])
    expect(by('longest-subarray-divisible-by-k-with-at-most-one-negation-ii').wrong).toBe(1) // Runtime Error, then accepted
    expect(by('score-of-parentheses').wrong).toBe(0)
    // Accepts older than the any-status window: struggle unknown, not "clean".
    const oldest = Math.min(...p.submissions.map(s => s.timestamp))
    const old = a.filter(x => x.timestamp < oldest)
    expect(old.length).toBeGreaterThan(0)
    expect(old.every(x => x.wrong === null)).toBe(true)
    expect(a.some(x => x.failed)).toBe(false)
  })

  it('turns wrong submissions with no accept into one failed attempt, ignoring compile errors and in-progress work', () => {
    const now = 100 * H
    const subs = [
      sub(1, 'lru-cache', 10 * H, 'Wrong Answer'), sub(2, 'lru-cache', 10.2 * H, 'Time Limit Exceeded'),
      sub(3, 'two-sum', 20 * H, 'Compile Error'),
      sub(4, 'word-ladder', now - IN_PROGRESS_MS / 2, 'Wrong Answer'),
      sub(5, 'coin-change', 30 * H, 'Wrong Answer'), sub(6, 'coin-change', 31 * H),
    ]
    const a = summarizeAttempts([sub(6, 'coin-change', 31 * H)], subs, now)
    const failed = a.filter(x => x.failed)
    expect(failed).toHaveLength(1)
    expect(failed[0]).toMatchObject({ id: 'fail:2', slug: 'lru-cache', wrong: 2, statuses: ['Wrong Answer', 'Time Limit Exceeded'] })
    expect(a.find(x => x.slug === 'coin-change')).toMatchObject({ wrong: 1, failed: false })
  })

  it('a failure more than a day before the accept is its own failed attempt', () => {
    const subs = [sub(1, 'coin-change', 0, 'Wrong Answer'), sub(2, 'coin-change', 30 * H)]
    const a = summarizeAttempts([subs[1]], subs, 100 * H)
    expect(a.find(x => x.failed)).toMatchObject({ id: 'fail:1' })
    expect(a.find(x => !x.failed).wrong).toBe(0)
  })

  it('maps attempts to outcome + confidence', () => {
    expect(attemptOutcome({ wrong: 0 })).toMatchObject({ outcome: 'solved', confidence: 4 })
    expect(attemptOutcome({ wrong: 1, statuses: ['Wrong Answer'] })).toMatchObject({ outcome: 'solved', confidence: 3 })
    expect(attemptOutcome({ wrong: 3 })).toMatchObject({ outcome: 'hinted' })
    expect(attemptOutcome({ wrong: null })).toMatchObject({ outcome: 'solved', confidence: null })
    expect(attemptOutcome({ failed: true, wrong: 2 }).outcome).toBe('failed')
  })

  it('schedules re-solves only for struggles, and credits a clean re-solve of a queued problem', () => {
    const t = d => new Date(Date.UTC(2026, 8, d)).toISOString()
    const items = [{ id: 'a', srs: null }, { id: 'b', srs: null }, { id: 'c', srs: null }]
    const logs = [
      { itemId: 'a', outcome: 'hinted', confidence: null, occurredAt: t(1) },
      { itemId: 'a', outcome: 'solved', confidence: 4, occurredAt: t(5) },
      { itemId: 'b', outcome: 'solved', confidence: 4, occurredAt: t(1) },
      { itemId: 'c', outcome: 'solved', confidence: null, occurredAt: t(1) },
    ]
    const u = reviewUpdates(logs, items)
    expect([...u.keys()]).toEqual(['a'])
    expect(new Date(u.get('a').dueAt) > new Date(t(6))).toBe(true)
    expect(u.get('a').srs.reps).toBe(2)
  })

  it('buildImport carries outcome, confidence and notes onto logs', async () => {
    const attempts = summarizeAttempts(p.recent, p.submissions, Date.now())
    const meta = await resolveQuestionMeta(attempts.map(r => r.slug), async () => ({ data: {} }))
    const { logs } = buildImport({ recent: attempts, meta, trackId: 't1' })
    const l = logs.find(x => x._slug === 'check-if-there-is-a-valid-parentheses-string-path')
    expect(l).toMatchObject({ outcome: 'solved', confidence: 3 })
    expect(l.notes).toMatch(/1 failed submission/)
  })
})

describe('history op (authenticated, one-off)', () => {
  const SESSION = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyIjoieCJ9.abc_DEF-123'

  it('accepts a session-shaped cookie value and a bounded skip, nothing else', () => {
    const r = buildLeetcodeRequest({ op: 'history', session: SESSION, skip: 200 })
    expect(r.session).toBe(SESSION)
    expect(r.variables).toEqual({ filters: { skip: 200, limit: HISTORY_PAGE } })
    expect(r.query).toMatch(/userProgressQuestionList/)
    expect(r.query).toMatch(/userStatus/)
    for (const bad of [
      { op: 'history' }, { op: 'history', session: 'short' }, { op: 'history', session: `${SESSION}; csrftoken=evil` },
      { op: 'history', session: SESSION, skip: -1 }, { op: 'history', session: SESSION, skip: 1.5 }, { op: 'history', session: SESSION, skip: 1e9 },
    ]) expect(() => buildLeetcodeRequest(bad), JSON.stringify(bad)).toThrow()
  })

  it('public ops never carry a cookie; history sends session + csrf pair', async () => {
    const fakeFetch = async () => ({ headers: { get: () => 'csrftoken=tok123; expires=Mon; Path=/, _cfuvid=zzz' } })
    const pub = await leetcodeHeaders(buildLeetcodeRequest({ op: 'profile', username: 'x' }), fakeFetch)
    expect(pub.Cookie).toBeUndefined()
    const h = await leetcodeHeaders(buildLeetcodeRequest({ op: 'history', session: SESSION }), fakeFetch)
    expect(h.Cookie).toBe(`csrftoken=tok123; LEETCODE_SESSION=${SESSION}`)
    expect(h['x-csrftoken']).toBe('tok123')
  })

  const page = (questions, { total = questions.length, username = 'larryny', signedIn = true } = {}) => ({
    data: { userStatus: { username, isSignedIn: signedIn }, userProgressQuestionList: { totalNum: total, questions } },
  })
  const q = (slug, status = 'SOLVED', extra = {}) => ({
    title: slug, titleSlug: slug, difficulty: 'MEDIUM', lastSubmittedAt: '2025-03-01T12:00:00+00:00', numSubmitted: 3,
    questionStatus: status, lastResult: status === 'SOLVED' ? 'AC' : 'WA', topicTags: [{ slug: 'tree' }], ...extra,
  })

  it('parses pages, including epoch-second and missing dates', () => {
    const p = parseHistoryPage(page([q('a'), q('b', 'ATTEMPTED', { lastSubmittedAt: 1700000000 }), q('c', 'SOLVED', { lastSubmittedAt: null })]))
    expect(p).toMatchObject({ username: 'larryny', signedIn: true, total: 3 })
    expect(p.questions[0]).toMatchObject({ slug: 'a', difficulty: 'Medium', solved: true, tags: ['tree'], submissions: 3 })
    expect(p.questions[0].lastAt).toBe(Date.parse('2025-03-01T12:00:00Z'))
    expect(p.questions[1]).toMatchObject({ solved: false, lastAt: 1700000000000 })
    expect(p.questions[2].lastAt).toBeNull()
  })

  it('builds one idempotent log per problem, skipping problems already logged', () => {
    const { questions } = parseHistoryPage(page([q('a'), q('b', 'ATTEMPTED'), q('c', 'SOLVED', { lastSubmittedAt: null })]))
    const { items, logs } = buildHistoryImport({ questions, trackId: 't', skipSlugs: new Set(['a']), now: Date.parse('2026-10-01') })
    expect(items).toHaveLength(3)
    expect(logs.map(l => [l.externalRef, l.outcome])).toEqual([['hist:b', 'failed'], ['hist:c', 'solved']])
    expect(logs[1].notes).toMatch(/date unknown/)
    expect(logs.every(l => l.confidence == null)).toBe(true)
  })

  it('pages until totalNum, and refuses expired or someone else\'s session', async () => {
    db.upsertLearningItems.mockImplementation(async items => items.map((it, i) => ({ ...it, id: `id-${it.externalRef}-${i}` })))
    db.importLearningLogs.mockImplementation(async rows => rows)
    const all = Array.from({ length: 150 }, (_, i) => q(`p${i}`, i % 10 === 0 ? 'ATTEMPTED' : 'SOLVED'))
    const calls = []
    const call = async body => { calls.push(body.skip); return page(all.slice(body.skip, body.skip + HISTORY_PAGE), { total: 150 }) }
    const res = await importLeetcodeHistory({ session: 's', trackId: 't', expectUsername: 'LarryNY', skipSlugs: new Set() }, call)
    expect(calls).toEqual([0, 100])
    expect(res).toMatchObject({ solved: 135, attempted: 15, imported: 150, skipped: 0 })

    await expect(importLeetcodeHistory({ session: 's', expectUsername: 'LarryNY' }, async () => page([], { signedIn: false })))
      .rejects.toThrow(/expired/)
    await expect(importLeetcodeHistory({ session: 's', expectUsername: 'LarryNY' }, async () => page([q('a')], { username: 'someoneelse' })))
      .rejects.toThrow(/someoneelse/)
  })
})

describe('language proficiency', () => {
  it('parses lifetime solves per language, most first', () => {
    const p = parseProfile(profileFixture)
    expect(p.languages[0].name).toBe('Python3')
    expect(p.languages[0].solved).toBeGreaterThan(p.languages[1].solved)
    expect(p.recent[0].lang).toBe('python3')
  })

  it('accumulates first-try / struggled / failed per language without double counting', () => {
    const attempts = [
      { id: '1', lang: 'python3', wrong: 0, timestamp: 10 },
      { id: '2', lang: 'python3', wrong: 2, timestamp: 20 },
      { id: '3', lang: 'cpp', wrong: null, timestamp: 30 },
      { id: 'fail:4', lang: 'cpp', failed: true, wrong: 1, timestamp: 40 },
      { id: '5', lang: null, wrong: 0, timestamp: 50 },
    ]
    const a = mergeLanguageStats(null, attempts, 1000)
    expect(a.byLang.Python3).toEqual({ solves: 2, firstTry: 1, struggled: 1, failed: 0, lastAt: 20 })
    expect(a.byLang['C++']).toEqual({ solves: 1, firstTry: 0, struggled: 0, failed: 1, lastAt: 40 })
    expect(a.since).toBe(1000)
    const b = mergeLanguageStats(a, [...attempts, { id: '6', lang: 'python3', wrong: 0, timestamp: 60 }], 2000)
    expect(b.byLang.Python3).toMatchObject({ solves: 3, firstTry: 2, lastAt: 60 })
    expect(b.since).toBe(1000)
    expect(a.byLang.Python3.solves).toBe(2) // prev not mutated
  })
})
