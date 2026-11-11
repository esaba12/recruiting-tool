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

describe('deriveTodayAttention', () => {
  it('counts interviews, decisions, drafted replies, OAs and follow-ups', () => {
    const a = derive()
    expect(a.appGroups.interview.map(x => x.id)).toEqual(['i1'])
    expect(a.decisions.map(x => x.id)).toEqual(['o1'])
    expect(a.appGroups.oa.map(x => x.id)).toEqual(['oa1'])
    expect(a.replyDrafts).toHaveLength(1)
    expect(a.peopleGroups.overdue.map(c => c.id)).toEqual(['c1'])
    expect(a.openCount).toBe(Object.values(a.counts).reduce((x, y) => x + y, 0))
    expect(a.openCount).toBeGreaterThanOrEqual(5)
  })

  it("a list turned off in the layout doesn't count", () => {
    const off = { ...layout, cards: layout.cards.map(c => c.id === 'apps' ? { ...c, off: ['oa'] } : c) }
    expect(derive({ layout: off }).openCount).toBe(derive().openCount - 1)
  })

  it("a card removed from the layout doesn't count", () => {
    const noReplies = { ...layout, cards: layout.cards.filter(c => c.id !== 'replies') }
    expect(derive({ layout: noReplies }).openCount).toBe(derive().openCount - 1)
  })

  it("a snoozed row doesn't count, and is reported as hidden", () => {
    const a = derive({ isSnoozed: k => k === snoozeKey('oa', apps[2]) })
    expect(a.openCount).toBe(derive().openCount - 1)
    expect(a.snoozedHidden).toBe(1)
  })

  it('uses the per-user stale threshold', () => {
    const at = days => ({ ...layout, cards: layout.cards.map(c => c.id === 'apps' ? { ...c, settings: { staleDays: days } } : c) })
    expect(derive({ layout: at(7) }).appGroups.stale.map(a => a.id)).toContain('s1')
    expect(derive({ layout: at(14) }).appGroups.stale.map(a => a.id)).not.toContain('s1')
  })
})
