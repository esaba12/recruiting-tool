import { describe, it, expect } from 'vitest'
import { hashText, splitFresh, runChunked, partialErrorMessage } from '../src/lib/ingest/hashGate.js'
import { pickDue, todayStr } from '../src/lib/ingest/scheduler.js'
import { dueCompanies } from '../src/lib/discoveryScheduler.js'

describe('hashGate', () => {
  it('hashText is stable and content-sensitive', () => {
    expect(hashText('abc')).toBe(hashText('abc'))
    expect(hashText('abc')).not.toBe(hashText('abd'))
  })
  it('splitFresh seeds scannedKeys with the unchanged candidates', () => {
    const cands = [{ key: 'a', hash: '1' }, { key: 'b', hash: '2' }, { key: 'c', hash: '3' }]
    const { fresh, scannedKeys } = splitFresh(cands, { a: '1', b: 'old' })
    expect(fresh.map(c => c.key)).toEqual(['b', 'c'])
    expect(scannedKeys).toEqual({ a: '1' })
  })
  it('runChunked excludes a failed chunk from scannedKeys so it retries next run', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ key: `k${i}`, hash: `h${i}` }))
    const { results, scannedKeys, errors, chunkCount } = await runChunked(items, 2, async chunk => {
      if (chunk[0].key === 'k2') throw new Error('boom')
      return chunk.map(c => c.key.toUpperCase())
    })
    expect(chunkCount).toBe(3)
    expect(results).toEqual(['K0', 'K1', 'K4'])
    expect(Object.keys(scannedKeys).sort()).toEqual(['k0', 'k1', 'k4'])
    expect(errors).toEqual(['boom'])
    expect(partialErrorMessage(errors, chunkCount, 'scan batch')).toBe('1/3 scan batch(es) failed (will retry next run): boom')
    expect(partialErrorMessage([], 3)).toBeNull()
  })
})

describe('scheduler.pickDue', () => {
  const now = 1_000_000_000_000
  const DAY = 86400000
  it('applies cooldown, priority tier, oldest-first rotation and budget', () => {
    const cands = [
      { key: 'fresh-hi', tier: 0, lastRun: now - 1 * DAY },   // inside cooldown → excluded
      { key: 'never-lo', tier: 3 },
      { key: 'old-mid', tier: 1, lastRun: now - 30 * DAY },
      { key: 'older-mid', tier: 1, lastRun: now - 40 * DAY },
      { key: 'never-hi', tier: 0 },
    ]
    const due = pickDue(cands, {}, { cooldownMs: 7 * DAY, budget: 3, now })
    expect(due.map(c => c.key)).toEqual(['never-hi', 'older-mid', 'old-mid'])
    expect(due[0]).not.toHaveProperty('lastRun')
  })
  it('reads lastRun from meta when the candidate lacks it', () => {
    const due = pickDue([{ key: 'x', tier: 0 }], { x: { lastRun: now - DAY } }, { cooldownMs: 7 * DAY, now })
    expect(due).toEqual([])
  })
  it('todayStr is a local YYYY-MM-DD', () => {
    expect(todayStr(new Date(2026, 8, 5))).toBe('2026-09-05')
  })
})

describe('discoveryScheduler.dueCompanies (behavior preserved after lifting pickDue)', () => {
  const now = 1_000_000_000_000
  const DAY = 86400000
  it('skips strong coverage, honours cooldown, orders by tier then rotation, caps budget', () => {
    const contacts = [{ id: 'c1', company: 'Strong Co', status: '🟢 Warm', lastInteraction: '2026-09-01' }]
    const apps = [{ company: 'Applied Gap', stage: 'Applied' }]
    const targets = ['Strong Co', 'Applied Gap', 'Cold Gap', 'Recent Gap']
    const meta = { perCompany: { 'recent gap': { lastRun: now - DAY, resultHash: 'r' }, 'cold gap': { lastRun: now - 30 * DAY, resultHash: 'h' } } }
    const due = dueCompanies(targets, contacts, apps, [], meta, { cooldownDays: 7, dailyBudget: 5, now })
    const keys = due.map(d => d.key)
    expect(keys).not.toContain('recent gap')
    expect(keys[0]).toBe('applied gap')
    expect(due.find(d => d.key === 'cold gap').priorResultHash).toBe('h')
    expect(due.every(d => !('lastRun' in d))).toBe(true)
  })
})
