import { describe, it, expect } from 'vitest'
import { openActionItems } from '../src/lib/attention.js'

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
