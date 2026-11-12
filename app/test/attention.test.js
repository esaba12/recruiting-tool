import { describe, it, expect } from 'vitest'
import { openActionItems, outstandingOas, recentUpdates } from '../src/lib/attention.js'

describe('openActionItems', () => {
  it('sorts high before medium before low priority', () => {
    const items = [
      { id: 'a', priority: 'low', dueDate: null },
      { id: 'b', priority: 'high', dueDate: null },
      { id: 'c', priority: 'medium', dueDate: null },
    ]
    expect(openActionItems(items).map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('within a priority tier, sorts soonest due date first', () => {
    const items = [
      { id: 'a', priority: 'high', dueDate: '2026-09-25' },
      { id: 'b', priority: 'high', dueDate: '2026-09-20' },
    ]
    expect(openActionItems(items).map(i => i.id)).toEqual(['b', 'a'])
  })

  it('items with no due date sort after items with one, within the same tier', () => {
    const items = [
      { id: 'a', priority: 'medium', dueDate: null },
      { id: 'b', priority: 'medium', dueDate: '2026-09-20' },
    ]
    expect(openActionItems(items).map(i => i.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const items = [{ id: 'a', priority: 'low' }, { id: 'b', priority: 'high' }]
    const copy = [...items]
    openActionItems(items)
    expect(items).toEqual(copy)
  })
})

describe('outstandingOas / recentUpdates (Today, 2026-11-11)', () => {
  it('keeps unfinished OAs on active apps, dated first', () => {
    const apps = [
      { id: 'a', oaLink: 'x', stage: 'Applied' },
      { id: 'b', oaDueDate: '2026-11-20', stage: 'Applied' },
      { id: 'c', oaDueDate: '2026-11-15', stage: 'Applied' },
      { id: 'd', oaDueDate: '2026-11-15', oaCompleted: true, stage: 'Applied' },
      { id: 'e', oaDueDate: '2026-11-15', stage: 'Rejected' },
      { id: 'f', stage: 'Applied' },
    ]
    expect(outstandingOas(apps).map(a => a.id)).toEqual(['c', 'b', 'a'])
  })
  it('skips Wishlist adds and caps the list', () => {
    const apps = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, stageEvents: [{ toStage: 'Wishlist', changedAt: '2026-11-01' }, { toStage: 'Applied', changedAt: `2026-11-0${i + 1}` }] }))
    const u = recentUpdates(apps)
    expect(u).toHaveLength(6)
    expect(u[0].app.id).toBe('x7')
    expect(u.every(x => x.toStage === 'Applied')).toBe(true)
  })
})
