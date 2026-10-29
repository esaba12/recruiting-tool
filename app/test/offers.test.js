import { describe, it, expect, vi } from 'vitest'
import { inProcessApps, inProcessRows, expediteTemplate, expediteContext } from '../src/lib/offers.js'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { buildDraftPrompt } = await import('../src/lib/drafting.js')

// 2026-10-28 15:00 local
const now = new Date(2026, 9, 28, 15).getTime()
const day = d => `2026-${d}`

const apps = [
  { id: 'o1', company: 'Ramp', role: 'SWE Intern', stage: 'Offer', offerDeadline: day('11-03') },
  { id: 'p1', company: 'Stripe', role: 'SWE Intern', stage: 'Phone Screen', lastActivity: day('10-26') },
  { id: 't1', company: 'Anthropic', role: 'SWE Intern', stage: 'Technical', lastActivity: day('10-27') },
  { id: 's1', company: 'Morgan Stanley', role: 'IB Analyst', stage: 'Onsite', lastActivity: day('10-25') },
  { id: 'a1', company: 'Figma', role: 'PM Intern', stage: 'Applied', lastActivity: day('10-24') },
  { id: 'a2', company: 'Vercel', role: 'SWE Intern', stage: 'Applied', lastActivity: day('09-01') },
  { id: 'a3', company: 'Linear', role: 'SWE Intern', stage: 'Applied', lastActivity: null, appliedDate: day('10-20') },
  { id: 'r1', company: 'Notion', role: 'SWE Intern', stage: 'Rejected', lastActivity: day('10-27') },
  { id: 'x1', company: 'Plaid', role: 'SWE Intern', stage: 'Accepted', lastActivity: day('10-27') },
  { id: 'w1', company: 'Airbnb', role: 'SWE Intern', stage: 'Wishlist', lastActivity: day('10-27') },
]

describe('inProcessApps (v1.4 spec 04)', () => {
  it('interview stages, plus Applied with activity in 30 days; no terminal, Wishlist or offers', () => {
    const ids = inProcessApps(apps, { now }).map(a => a.id)
    expect(ids).toEqual(expect.arrayContaining(['p1', 't1', 's1', 'a1', 'a3']))
    expect(ids).not.toContain('a2') // Applied, nothing in 58 days
    for (const id of ['o1', 'r1', 'x1', 'w1']) expect(ids).not.toContain(id)
  })

  it('furthest stage first, then most recent activity', () => {
    expect(inProcessApps(apps, { now }).map(a => a.id)).toEqual(['s1', 't1', 'p1', 'a1', 'a3'])
  })

  it('pairs each with a contact at the company when one exists', () => {
    const kelly = { id: 'c1', name: 'Kelly Sanders', company: 'stripe ' }
    const rows = inProcessRows(apps, [kelly], [], { now })
    expect(rows.find(r => r.app.id === 'p1').contact).toBe(kelly)
    expect(rows.find(r => r.app.id === 't1').contact).toBeNull()
  })
})

describe('expedite drafts', () => {
  const stripe = apps[1]
  const kelly = { id: 'c1', name: 'Kelly Sanders', company: 'Stripe' }

  it('the template names the deadline and the role, never the competing company', () => {
    const t = expediteTemplate({ contact: kelly, app: stripe, deadline: day('11-03') })
    expect(t).toMatch(/^Hi Kelly/)
    expect(t).toContain('November 3')
    expect(t).toContain('Stripe')
    expect(t).not.toContain('Ramp')
  })

  it('reads fine with no contact and no deadline on file', () => {
    const t = expediteTemplate({ contact: null, app: stripe, deadline: null })
    expect(t).toMatch(/^Hi there/)
    expect(t).not.toMatch(/undefined|null/)
  })

  it('the AI prompt carries the deadline and leaves the competitor out', () => {
    const ctx = expediteContext({ app: stripe, deadline: day('11-03') })
    const p = buildDraftPrompt({ contact: kelly, kind: 'expedite', personalizationContext: ctx, profile: null })
    expect(p).toContain('November 3')
    expect(p).toContain('Phone Screen')
    expect(p).not.toContain('Ramp')
    expect(p).toMatch(/never name/i)
  })
})
