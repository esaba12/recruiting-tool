import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
import { affinityProfileFor, DEFAULT_WEIGHTS } from '../src/lib/discovery.js'
import { isTargetCompany } from '../src/lib/enrichment.js'

// v1.4 spec 06 A: Quick Add read the dead rec_target_companies localStorage key and an
// unseeded affinity profile, so "at a target company" and the alum tag never showed.

describe('affinityProfileFor', () => {
  it('seeds university and grad year from the account profile when nothing is stored', () => {
    const p = affinityProfileFor(null, { school: 'Ohio State', grad_year: 2027 })
    expect(p.university).toBe('Ohio State')
    expect(p.gradYear).toBe(2027)
    expect(p.weights).toEqual(DEFAULT_WEIGHTS)
  })

  it('lets the stored Discover profile win over the seed', () => {
    const p = affinityProfileFor({ university: 'MIT', weights: { university: 9 } }, { school: 'Ohio State' })
    expect(p.university).toBe('MIT')
    expect(p.weights.university).toBe(9)
    expect(p.weights.pastEmployer).toBe(DEFAULT_WEIGHTS.pastEmployer)
  })

  it('works with no account profile at all', () => {
    expect(affinityProfileFor(null, null).university).toBe('')
  })
})

describe('isTargetCompany', () => {
  it('matches on the normalized company name', () => {
    expect(isTargetCompany('Goldman Sachs', ['goldman sachs'])).toBe(true)
    expect(isTargetCompany('  Stripe ', ['Stripe'])).toBe(true)
  })

  it('is false for a blank company or no targets', () => {
    expect(isTargetCompany('', ['Stripe'])).toBe(false)
    expect(isTargetCompany('Stripe', [])).toBe(false)
    expect(isTargetCompany('Stripe', undefined)).toBe(false)
  })
})
