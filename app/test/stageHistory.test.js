import { describe, it, expect } from 'vitest'
import { synthesizeStageEvents, attachStageHistory, stagePath, recentStageChange, describeStageChange } from '../src/lib/stageHistory.js'

const NOW = new Date(2026, 9, 16, 12).getTime()

describe('synthesizeStageEvents', () => {
  it('a wishlist row is one creation event', () => {
    const ev = synthesizeStageEvents({ stage: 'Wishlist', createdTime: '2026-10-01T10:00:00Z' })
    expect(ev).toEqual([{ fromStage: null, toStage: 'Wishlist', changedAt: '2026-10-01T10:00:00Z', source: 'backfill' }])
  })

  it('an applied row starts at Applied on its applied date', () => {
    const ev = synthesizeStageEvents({ stage: 'Applied', appliedDate: '2026-10-02', createdTime: '2026-09-30T00:00:00Z' })
    expect(ev.map(e => [e.fromStage, e.toStage, e.changedAt])).toEqual([[null, 'Applied', '2026-10-02']])
  })

  it('a rejection goes Applied → Rejected on the closed date', () => {
    const ev = synthesizeStageEvents({ stage: 'Rejected', appliedDate: '2026-09-01', closedDate: '2026-09-20', lastActivity: '2026-09-10' })
    expect(ev.map(e => [e.fromStage, e.toStage, e.changedAt])).toEqual([[null, 'Applied', '2026-09-01'], ['Applied', 'Rejected', '2026-09-20']])
  })

  it('never dates the move before the application', () => {
    const ev = synthesizeStageEvents({ stage: 'Onsite', appliedDate: '2026-09-10', lastActivity: '2026-09-01' })
    expect(ev[1].changedAt).toBe('2026-09-10')
  })
})

describe('attachStageHistory', () => {
  const app = { id: 'a1', stage: 'Phone Screen', appliedDate: '2026-09-01', createdTime: '2026-09-01T00:00:00Z', daysInStage: 45 }

  it('uses real events, sorted, and counts days from the latest change', () => {
    const events = [
      { applicationId: 'a1', fromStage: 'Applied', toStage: 'Phone Screen', changedAt: new Date(2026, 9, 11, 9).toISOString(), source: 'pipeline' },
      { applicationId: 'a1', fromStage: null, toStage: 'Applied', changedAt: new Date(2026, 8, 1, 9).toISOString(), source: 'user' },
      { applicationId: 'other', fromStage: null, toStage: 'Applied', changedAt: '2026-09-01', source: 'user' },
    ]
    const [out] = attachStageHistory([app], events, NOW)
    expect(out.stageEvents.map(e => e.toStage)).toEqual(['Applied', 'Phone Screen'])
    expect(out.daysInStage).toBe(5)
    expect(out.historyEstimated).toBe(false)
  })

  it('synthesizes when the table could not be read', () => {
    const [out] = attachStageHistory([app], null, NOW)
    expect(out.historyEstimated).toBe(true)
    expect(out.stageEvents).toHaveLength(2)
  })

  it('keeps the old daysInStage when history does not end at the current stage', () => {
    const events = [{ applicationId: 'a1', fromStage: null, toStage: 'Applied', changedAt: '2026-09-01', source: 'user' }]
    const [out] = attachStageHistory([app], events, NOW)
    expect(out.stageChangedAt).toBe(null)
    expect(out.daysInStage).toBe(45)
  })
})

describe('stagePath', () => {
  it('orders visited stages and keeps only the first visit', () => {
    const app = {
      stage: 'Phone Screen',
      stageEvents: [
        { toStage: 'Applied' }, { toStage: 'Phone Screen' }, { toStage: 'Onsite' }, { toStage: 'Phone Screen' },
      ],
    }
    expect(stagePath(app)).toEqual(['Applied', 'Phone Screen', 'Onsite'])
  })

  it('appends the current stage when history is missing it', () => {
    expect(stagePath({ stage: 'Offer', stageEvents: [{ toStage: 'Applied' }] })).toEqual(['Applied', 'Offer'])
  })
})

describe('recentStageChange', () => {
  const now = new Date('2026-10-16T12:00:00Z').getTime()
  const at = h => new Date(now - h * 36e5).toISOString()
  it('reports the latest real move inside the window', () => {
    const app = { stageEvents: [
      { fromStage: null, toStage: 'Applied', changedAt: at(100), source: 'user' },
      { fromStage: 'Applied', toStage: 'Rejected', changedAt: at(5), source: 'pipeline' },
    ] }
    const c = recentStageChange(app, now)
    expect(c).toEqual({ fromStage: 'Applied', toStage: 'Rejected', hoursAgo: 5, source: 'pipeline' })
    expect(describeStageChange(c)).toBe('Applied → Rejected · 5h ago · from email')
  })
  it('ignores backfill, creations, and anything older than the window', () => {
    expect(recentStageChange({ stageEvents: [{ fromStage: 'Applied', toStage: 'Rejected', changedAt: at(1), source: 'backfill' }] }, now)).toBe(null)
    expect(recentStageChange({ stageEvents: [{ fromStage: null, toStage: 'Applied', changedAt: at(1), source: 'user' }] }, now)).toBe(null)
    expect(recentStageChange({ stageEvents: [{ fromStage: 'Applied', toStage: 'Onsite', changedAt: at(60), source: 'user' }] }, now)).toBe(null)
  })
})
