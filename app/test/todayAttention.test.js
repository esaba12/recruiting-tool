import { describe, it, expect } from 'vitest'
import { deriveTodayAttention, snoozeKey } from '../src/lib/todayAttention.js'
import { defaultLayout, layoutContext } from '../src/lib/todayCards.js'

// v1.5 spec 02: one derivation behind both Today and the sidebar badge.
// Real "now": staleApplications and oaDue read the clock themselves.
const NOW = Date.now()
const day = n => { const d = new Date(NOW + n * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const ctx = layoutContext({ tracks: ['swe'] }, null)
const layout = defaultLayout(ctx)

const apps = [
  { id: 'i1', company: 'Anthropic', role: 'SWE', stage: 'Technical', interviewAt: new Date(NOW + 2 * 86400000).toISOString(), interviewTimeKnown: true, lastActivity: day(-1), appliedDate: day(-20), triage: 'Applied' },
  { id: 'o1', company: 'Ramp', role: 'SWE', stage: 'Offer', offerDeadline: day(5), lastActivity: day(-1), appliedDate: day(-40), triage: 'Applied' },
  { id: 'oa1', company: 'HRT', role: 'SWE', stage: 'Applied', oaDueDate: day(0), oaCompleted: false, lastActivity: day(-1), appliedDate: day(-3), triage: 'Applied' },
  { id: 's1', company: 'Plaid', role: 'SWE', stage: 'Applied', lastActivity: day(-10), appliedDate: day(-10), triage: 'Applied' },
]
const contacts = [{ id: 'c1', name: 'Ryan', status: '🟡 Cooling', followUpDate: day(-1) }]
const emailDrafts = [{ id: 'd1', threadId: 't1', status: 'open' }]

const derive = (over = {}) => deriveTodayAttention({ contacts, apps, interactions: [], actionItems: [], emailDrafts, eventPool: null }, { layout, ctx, now: NOW, ...over })

const withQueue = fn => ({ ...layout, cards: layout.cards.map(c => c.id === 'queue' ? fn(c) : c) })

describe('deriveTodayAttention', () => {
  it('derives every list the queue needs and counts only Now', () => {
    const a = derive()
    expect(a.appGroups.interview.map(x => x.id)).toEqual(['i1'])
    expect(a.decisions.map(x => x.id)).toEqual(['o1'])
    expect(a.appGroups.oa.map(x => x.id)).toEqual(['oa1'])
    expect(a.replyDrafts).toHaveLength(1)
    expect(a.peopleGroups.overdue.map(c => c.id)).toEqual(['c1'])
    expect(a.queue.now.map(i => i.key).sort()).toEqual(['oa:oa1', 'overdue:c1'])
    expect(a.queue.week.map(i => i.key).sort()).toEqual(['decisions:o1', 'interview:i1', 'replies:d1'])
    expect(a.openCount).toBe(2)
  })

  it("a kind turned off in the queue doesn't count", () => {
    expect(derive({ layout: withQueue(c => ({ ...c, off: ['oa'] })) }).openCount).toBe(1)
  })

  it('without the queue, the old cards still derive their lists and the count is their sum', () => {
    const old = { v: 2, seen: [], cards: [{ id: 'apps', size: 'half', cap: 3, off: [], settings: {} }] }
    const a = derive({ layout: old })
    expect(a.queue).toBeNull()
    expect(a.decisions).toEqual([])
    expect(a.openCount).toBe(a.counts.apps)
    expect(a.counts.apps).toBe(2) // interview + OA
  })

  it("a snoozed row doesn't count, and is reported as hidden", () => {
    const a = derive({ isSnoozed: k => k === snoozeKey('oa', apps[2]) })
    expect(a.openCount).toBe(derive().openCount - 1)
    expect(a.snoozedHidden).toBe(1)
  })

  it("uses the queue's stale threshold (stale apps go to the backlog, which doesn't count)", () => {
    const at = days => withQueue(c => ({ ...c, settings: { staleDays: days } }))
    const seven = derive({ layout: at(7) })
    expect(seven.appGroups.stale.map(a => a.id)).toContain('s1')
    expect(seven.queue.later.map(i => i.key)).toContain('stale:s1')
    expect(seven.openCount).toBe(derive().openCount)
    expect(derive({ layout: at(14) }).appGroups.stale.map(a => a.id)).not.toContain('s1')
  })
})
