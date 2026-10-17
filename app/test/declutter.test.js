import { describe, it, expect } from 'vitest'
import { trimActionItems, dedupeAcross } from '../src/lib/attention.js'

const NOW = new Date('2026-10-16T12:00:00').getTime()
const item = (id, extra = {}) => ({ id, summary: `do ${id}`, priority: 'medium', createdAt: '2026-10-14T09:00:00Z', ...extra })

describe('trimActionItems', () => {
  it('keeps a fresh item', () => {
    expect(trimActionItems([item('a')], [], { now: NOW })).toEqual({ items: [item('a')], hidden: 0 })
  })
  it('drops items on a thread you replied to after they were flagged', () => {
    const ints = [{ direction: 'Outbound', channelRef: 't1', sentAt: '2026-10-15T10:00:00Z' }]
    const before = [{ direction: 'Outbound', channelRef: 't1', sentAt: '2026-10-13T10:00:00Z' }]
    expect(trimActionItems([item('a', { threadId: 't1' })], ints, { now: NOW }).hidden).toBe(1)
    expect(trimActionItems([item('a', { threadId: 't1' })], before, { now: NOW }).hidden).toBe(0)
  })
  it('expires long-past due dates and old undated items', () => {
    const r = trimActionItems([
      item('late', { dueDate: '2026-10-01' }),
      item('recentlyLate', { dueDate: '2026-10-12' }),
      item('old', { createdAt: '2026-09-01T00:00:00Z' }),
    ], [], { now: NOW })
    expect(r.items.map(i => i.id)).toEqual(['recentlyLate'])
    expect(r.hidden).toBe(2)
  })
  it('dedupes same summary for the same contact', () => {
    const r = trimActionItems([item('a', { contactId: 'c', summary: 'Reply to Jane' }), item('b', { contactId: 'c', summary: 'reply to jane ' })], [], { now: NOW })
    expect(r.items.map(i => i.id)).toEqual(['a'])
  })
})

describe('dedupeAcross', () => {
  it('keeps each contact only in its first list', () => {
    const out = dedupeAcross({ overdue: [{ id: 1 }], awaiting: [{ contact: { id: 1 } }, { contact: { id: 2 } }], urgent: [{ id: 2 }, { id: 3 }] })
    expect(out).toEqual({ overdue: [{ id: 1 }], awaiting: [{ contact: { id: 2 } }], urgent: [{ id: 3 }] })
  })
})
