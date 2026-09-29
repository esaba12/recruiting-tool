import { describe, it, expect } from 'vitest'
import { scheduleAttempt, reviewQueue, ratingFor } from '../src/lib/learning/review.js'
import { Rating } from 'ts-fsrs'

const now = new Date('2026-09-30T15:00:00Z')

describe('re-solve queue scheduling', () => {
  it('maps outcomes to ratings', () => {
    expect(ratingFor({ outcome: 'failed' })).toBe(Rating.Again)
    expect(ratingFor({ outcome: 'hinted' })).toBe(Rating.Hard)
    expect(ratingFor({ outcome: 'solved', confidence: 3 })).toBe(Rating.Good)
    expect(ratingFor({ outcome: 'solved', confidence: 5 })).toBe(Rating.Easy)
  })

  it('a confident first solve never enters the queue', () => {
    expect(scheduleAttempt({ srs: null }, { outcome: 'solved', confidence: 5 }, now)).toBe(null)
  })

  it('a failure enqueues no sooner than tomorrow and round-trips through JSON', () => {
    const r = scheduleAttempt({ srs: null }, { outcome: 'failed' }, now)
    expect(new Date(r.dueAt).getTime()).toBeGreaterThanOrEqual(now.getTime() + 86400000)
    const stored = JSON.parse(JSON.stringify(r.srs))
    const later = new Date(r.dueAt)
    const r2 = scheduleAttempt({ srs: stored }, { outcome: 'solved', confidence: 4 }, later)
    expect(new Date(r2.dueAt).getTime()).toBeGreaterThan(later.getTime())
    expect(r2.srs.reps).toBe(2)
  })

  it('successful reviews push the interval out further than struggling ones', () => {
    const first = scheduleAttempt({ srs: null }, { outcome: 'hinted' }, now)
    const at = new Date(first.dueAt)
    const good = scheduleAttempt({ srs: first.srs }, { outcome: 'solved', confidence: 4 }, at)
    const bad = scheduleAttempt({ srs: first.srs }, { outcome: 'failed' }, at)
    expect(new Date(good.dueAt).getTime()).toBeGreaterThan(new Date(bad.dueAt).getTime())
  })

  it('reviewQueue returns due items soonest first', () => {
    const items = [
      { id: 'a', dueAt: '2026-09-29T00:00:00Z' }, { id: 'b', dueAt: '2026-09-28T00:00:00Z' },
      { id: 'c', dueAt: '2026-10-05T00:00:00Z' }, { id: 'd', dueAt: null },
    ]
    expect(reviewQueue(items, { now: now.getTime() }).map(i => i.id)).toEqual(['b', 'a'])
    expect(reviewQueue(items, { now: now.getTime(), aheadDays: 7 }).map(i => i.id)).toEqual(['b', 'a', 'c'])
  })
})
