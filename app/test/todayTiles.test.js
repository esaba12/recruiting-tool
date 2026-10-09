import { describe, it, expect } from 'vitest'
import { pickNextDeadline, funnelConversions } from '../src/lib/attention.js'

const now = new Date(2026, 9, 9, 12).getTime()

describe('pickNextDeadline', () => {
  it('picks an open OA and labels it', () => {
    const r = pickNextDeadline([{ company: 'Stripe', stage: 'Applied', oaDueDate: '2026-10-12' }], [], now)
    expect(r).toMatchObject({ label: 'Stripe OA', days: 3, kind: 'oa' })
  })
  it('ignores completed, past, and rejected/accepted OAs', () => {
    const apps = [
      { company: 'A', stage: 'Applied', oaDueDate: '2026-10-12', oaCompleted: true },
      { company: 'B', stage: 'Applied', oaDueDate: '2026-10-01' },
      { company: 'C', stage: 'Rejected', oaDueDate: '2026-10-12' },
      { company: 'D', stage: 'Accepted', oaDueDate: '2026-10-12' },
    ]
    expect(pickNextDeadline(apps, [], now)).toBeNull()
  })
  it('takes the soonest across OAs and job deadlines', () => {
    const apps = [{ company: 'Stripe', stage: 'Applied', oaDueDate: '2026-10-14' }]
    expect(pickNextDeadline(apps, [{ company: 'Figma', days: 2 }], now).company).toBe('Figma')
    expect(pickNextDeadline(apps, [{ company: 'Figma', days: 9 }], now).company).toBe('Stripe')
  })
  it('counts an OA due today', () => {
    expect(pickNextDeadline([{ company: 'X', stage: 'Applied', oaDueDate: '2026-10-09' }], [], now).days).toBe(0)
  })
})

describe('funnelConversions', () => {
  const mk = stages => stages.map(stage => ({ stage }))
  it('never exceeds 100% when most apps are past Wishlist', () => {
    const c = funnelConversions(mk(['Wishlist', 'Applied', 'Applied', 'Applied', 'Phone Screen', 'Technical']))
    expect(c.every(x => x.pct <= 100)).toBe(true)
    expect(c[0]).toMatchObject({ from: 'Wishlist', to: 'Applied', pct: 83 })
    expect(c[1]).toMatchObject({ from: 'Applied', to: 'Phone Screen', pct: 40 })
  })
  it('treats Accepted as having reached Offer and skips Rejected', () => {
    const c = funnelConversions(mk(['Applied', 'Accepted', 'Rejected']))
    expect(c.find(x => x.to === 'Offer').pct).toBe(100)
    expect(c[0].pct).toBe(100)
    expect(c.find(x => x.from === 'Applied' && x.to === 'Phone Screen').pct).toBe(50)
  })
  it('omits stages with no one reaching them', () => {
    expect(funnelConversions(mk(['Wishlist']))).toEqual([{ from: 'Wishlist', to: 'Applied', pct: 0 }])
  })
})
