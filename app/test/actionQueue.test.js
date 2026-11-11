import { describe, it, expect } from 'vitest'
import { buildActionQueue, nextUp, backlogSummary, QUEUE_KINDS } from '../src/lib/actionQueue.js'

// v1.5 spec 03: tiering and order.
const NOW = new Date(2026, 10, 11, 9, 0).getTime() // Wed Nov 11 2026, 9:00 local
const HOUR = 3600000
const DAY = 24 * HOUR
const day = n => { const d = new Date(NOW + n * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const at = h => new Date(NOW + h * HOUR).toISOString()

const q = attention => buildActionQueue(attention, { now: NOW })
const tierOf = (queue, key) => ['now', 'week', 'later'].find(t => queue[t].some(i => i.key === key))

describe('tiers', () => {
  it('interviews: within 36h now, within 7 days this week, further later', () => {
    const queue = q({ appGroups: { interview: [{ id: 'a', interviewAt: at(30) }, { id: 'b', interviewAt: at(40) }, { id: 'c', interviewAt: at(24 * 9) }] } })
    expect([tierOf(queue, 'interview:a'), tierOf(queue, 'interview:b'), tierOf(queue, 'interview:c')]).toEqual(['now', 'week', 'later'])
  })

  it('offers: deadline within 3 days now, else this week (no deadline too)', () => {
    const queue = q({ decisions: [{ id: 'a', offerDeadline: day(3) }, { id: 'b', offerDeadline: day(4) }, { id: 'c' }] })
    expect([tierOf(queue, 'decisions:a'), tierOf(queue, 'decisions:b'), tierOf(queue, 'decisions:c')]).toEqual(['now', 'week', 'week'])
  })

  it('OAs: due today or past now, within 7 days this week, further later', () => {
    const queue = q({ appGroups: { oa: [{ id: 'a', oaDueDate: day(-1) }, { id: 'b', oaDueDate: day(0) }, { id: 'c', oaDueDate: day(7) }, { id: 'd', oaDueDate: day(8) }] } })
    expect(['a', 'b', 'c', 'd'].map(id => tierOf(queue, `oa:${id}`))).toEqual(['now', 'now', 'week', 'later'])
  })

  it('drafted replies: 2+ days old now, newer this week', () => {
    const queue = q({ replyDrafts: [{ id: 'a', createdAt: at(-49) }, { id: 'b', createdAt: at(-5) }] })
    expect([tierOf(queue, 'replies:a'), tierOf(queue, 'replies:b')]).toEqual(['now', 'week'])
  })

  it('people: thank-yous and overdue follow-ups now; awaiting, urgent this week; keep in touch later', () => {
    const queue = q({ peopleGroups: {
      thankYou: [{ id: 't', at: at(-20) }], overdue: [{ id: 'o', followUpDate: day(-2) }],
      awaiting: [{ contact: { id: 'w' }, lastInteraction: { date: day(-6) } }], urgent: [{ id: 'u', followUpDate: day(4) }],
      schedule: [{ id: 's1', scheduleBy: day(0) }, { id: 's2', scheduleBy: day(3) }, { id: 's3' }],
      keepInTouch: [{ contact: { id: 'k' } }],
    } })
    expect(['thankYou:t', 'overdue:o', 'awaiting:w', 'urgent:u', 'schedule:s1', 'schedule:s2', 'schedule:s3', 'keepInTouch:k'].map(k => tierOf(queue, k)))
      .toEqual(['now', 'now', 'week', 'week', 'now', 'week', 'week', 'later'])
  })

  it('email to-dos: due today or past now, otherwise this week', () => {
    const queue = q({ openItems: [{ id: 'a', dueDate: day(0) }, { id: 'b', dueDate: day(5) }, { id: 'c' }] })
    expect(['a', 'b', 'c'].map(id => tierOf(queue, `email:${id}`))).toEqual(['now', 'week', 'week'])
  })

  it('events: overdue steps and registrations closing within 2 days now', () => {
    const ev = id => ({ id })
    const queue = q({ eventAttention: {
      steps: [{ event: ev('e1'), requirement: { id: 'r1' }, overdue: true, dueMs: NOW - DAY }, { event: ev('e2'), requirement: { id: 'r2' }, overdue: false, dueMs: NOW + 3 * DAY }],
      registrations: [{ event: ev('e3'), dueMs: NOW + 47 * HOUR }, { event: ev('e4'), dueMs: NOW + 4 * DAY }],
      followUps: [{ event: ev('e5'), userEvent: { id: 'u5', followupDueAt: at(-30) } }],
    } })
    expect(['step:e1:r1', 'step:e2:r2', 'registration:e3', 'registration:e4', 'eventFollowUp:u5'].map(k => tierOf(queue, k)))
      .toEqual(['now', 'week', 'now', 'week', 'now'])
  })

  it('stale, job boards to review and OA deadline unknown are backlog', () => {
    const queue = q({ appGroups: { stale: [{ id: 's' }], review: [{ id: 'r' }], oaCheck: [{ id: 'c' }] } })
    expect(queue.later.map(i => i.key)).toEqual(['stale:s', 'review:r', 'oaCheck:c'])
    expect(queue.count).toBe(0)
  })
})

describe('order', () => {
  it('dated items first, soonest due; then undated, oldest first', () => {
    const queue = q({
      appGroups: { oa: [{ id: 'late', oaDueDate: day(-1) }] },
      peopleGroups: { overdue: [{ id: 'early', followUpDate: day(-3) }], thankYou: [{ id: 'newer', at: at(-2) }, { id: 'older', at: at(-30) }] },
    })
    expect(queue.now.map(i => i.key)).toEqual(['overdue:early', 'oa:late', 'thankYou:older', 'thankYou:newer'])
  })

  it('count is Now + This week', () => {
    const queue = q({ decisions: [{ id: 'a', offerDeadline: day(1) }, { id: 'b', offerDeadline: day(6) }], appGroups: { stale: [{ id: 's' }] } })
    expect(queue.count).toBe(2)
  })
})

describe('helpers', () => {
  it('nextUp is the earliest dated item outside Now', () => {
    const queue = q({ appGroups: { interview: [{ id: 'far', interviewAt: at(24 * 10) }, { id: 'soon', interviewAt: at(48) }], stale: [{ id: 's' }] } })
    expect(nextUp(queue).key).toBe('interview:soon')
    expect(nextUp(q({}))).toBeNull()
  })

  it('backlogSummary counts by kind in registry order', () => {
    const queue = q({ appGroups: { review: [{ id: 'r' }], stale: [{ id: 'a' }, { id: 'b' }] } })
    expect(backlogSummary(queue.later)).toEqual([
      { kind: 'stale', label: 'Stale applications', count: 2 },
      { kind: 'review', label: 'Job boards to review', count: 1 },
    ])
  })

  it('every kind has a short label, and snoozable kinds name their list', () => {
    for (const k of QUEUE_KINDS) expect(k.short).toBeTruthy()
    expect(QUEUE_KINDS.filter(k => !k.list).map(k => k.id)).toEqual(['email', 'events'])
  })
})
