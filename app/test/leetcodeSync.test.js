import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
vi.mock('../src/db.js', () => ({ upsertLearningItems: vi.fn(), importLearningLogs: vi.fn(), setUserSetting: vi.fn(), updateLearningItem: vi.fn() }))
import { readFileSync } from 'node:fs'
import { syncLeetcode, syncDue, SYNC_INTERVAL_MS, SYNCED_IDS_CAP } from '../src/lib/learning/leetcodeImport.js'
import * as db from '../src/db.js'

const profile = JSON.parse(readFileSync(new URL('./fixtures/leetcode-profile.json', import.meta.url)))
const questions = JSON.parse(readFileSync(new URL('./fixtures/leetcode-questions.json', import.meta.url)))
const call = vi.fn(async p => (p.op === 'profile' ? profile : questions))

beforeEach(() => {
  vi.clearAllMocks()
  db.upsertLearningItems.mockImplementation(async items => items.map((i, n) => ({ ...i, id: `item-${n}` })))
  db.importLearningLogs.mockImplementation(async rows => rows.map((r, n) => ({ ...r, id: `log-${n}` })))
  db.setUserSetting.mockResolvedValue(undefined)
})

// LeetCode only ever shows the last 20 submissions, so every solve has to be stored the first
// time it's seen. Syncing often is what keeps solves from scrolling out of that window, and a
// sync with nothing new must write nothing, or frequent syncs would churn Supabase.
describe('syncLeetcode — incremental', () => {
  it('first sync stores every visible attempt and remembers their ids', async () => {
    const res = await syncLeetcode({ username: 'LarryNY', trackId: 't1' }, call)
    expect(db.importLearningLogs).toHaveBeenCalledTimes(1)
    const rows = db.importLearningLogs.mock.calls[0][0]
    expect(rows.length).toBeGreaterThan(0)
    expect(res.snapshot.syncedIds).toEqual(expect.arrayContaining(rows.map(r => r.externalRef)))
    expect(db.setUserSetting).toHaveBeenCalledTimes(1)
  })

  it('a re-sync with no new submissions makes zero Supabase writes', async () => {
    const first = await syncLeetcode({ username: 'LarryNY', trackId: 't1' }, call)
    vi.clearAllMocks()
    const res = await syncLeetcode({ username: 'LarryNY', trackId: 't1', prev: first.snapshot }, call)
    expect(res.imported).toBe(0)
    expect(res.unchanged).toBe(true)
    expect(db.upsertLearningItems).not.toHaveBeenCalled()
    expect(db.importLearningLogs).not.toHaveBeenCalled()
    expect(db.setUserSetting).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(1) // profile only — no per-question lookups
  })

  it('still a no-op when the stored snapshot came back from jsonb with keys reordered', async () => {
    const first = await syncLeetcode({ username: 'LarryNY', trackId: 't1' }, call)
    const reorder = o => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.keys(o).sort().reverse().map(k => [k, reorder(o[k])])) : Array.isArray(o) ? o.map(reorder) : o)
    vi.clearAllMocks()
    const res = await syncLeetcode({ username: 'LarryNY', trackId: 't1', prev: reorder(first.snapshot) }, call)
    expect(res.unchanged).toBe(true)
    expect(db.setUserSetting).not.toHaveBeenCalled()
  })

  it('only the new submission is written when one appears', async () => {
    const first = await syncLeetcode({ username: 'LarryNY', trackId: 't1' }, call)
    vi.clearAllMocks()
    const next = structuredClone(profile)
    const ts = String(Math.floor(Date.now() / 1000) - 3600)
    const sub = { id: '999999999', title: 'Two Sum', titleSlug: 'two-sum', timestamp: ts, lang: 'python3' }
    next.data.recentAcSubmissionList = [sub, ...next.data.recentAcSubmissionList.slice(0, 19)]
    next.data.recentSubmissionList = [{ ...sub, statusDisplay: 'Accepted' }, ...next.data.recentSubmissionList.slice(0, 19)]
    const res = await syncLeetcode({ username: 'LarryNY', trackId: 't1', prev: first.snapshot }, async p => (p.op === 'profile' ? next : questions))
    const rows = db.importLearningLogs.mock.calls[0][0]
    expect(rows.map(r => r.externalRef)).toEqual(['999999999'])
    expect(db.upsertLearningItems.mock.calls[0][0].map(i => i.externalRef)).toEqual(['two-sum'])
    expect(res.snapshot.syncedIds).toContain('999999999')
  })

  it('a different username starts fresh rather than trusting the old ids', async () => {
    const first = await syncLeetcode({ username: 'LarryNY', trackId: 't1' }, call)
    vi.clearAllMocks()
    await syncLeetcode({ username: 'LarryNY', trackId: 't1', prev: { ...first.snapshot, username: 'someone_else' } }, call)
    expect(db.importLearningLogs).toHaveBeenCalledTimes(1)
  })

  it('caps the remembered ids', async () => {
    const prev = { username: 'LarryNY', syncedIds: Array.from({ length: SYNCED_IDS_CAP + 50 }, (_, i) => `old${i}`) }
    const res = await syncLeetcode({ username: 'LarryNY', trackId: 't1', prev }, call)
    expect(res.snapshot.syncedIds.length).toBeLessThanOrEqual(SYNCED_IDS_CAP)
  })
})

describe('syncDue', () => {
  const now = Date.parse('2026-10-10T18:00:00Z')
  it('is due with no record, or a legacy YYYY-MM-DD day record', () => {
    expect(syncDue(undefined, now)).toBe(true)
    expect(syncDue('2026-10-10', now)).toBe(true)
  })
  it('respects the interval', () => {
    expect(syncDue(now - SYNC_INTERVAL_MS + 60000, now)).toBe(false)
    expect(syncDue(now - SYNC_INTERVAL_MS - 1, now)).toBe(true)
  })
  it('syncs more than once a day so 20-submission windows overlap', () => {
    expect(SYNC_INTERVAL_MS).toBeLessThan(24 * 3600000)
  })
})
