import { describe, it, expect } from 'vitest'
import { resolveEmployer, resolveEmployerId, warmEmployerIds } from '../src/lib/employers.js'

const employers = [
  { id: 'e1', name: 'Stripe', normalizedName: 'stripe' },
  { id: 'e2', name: 'Anthropic', normalizedName: 'anthropic' },
]

describe('employer resolution', () => {
  it('matches free text through normalizeCompanyName (trim + lowercase)', () => {
    expect(resolveEmployer('  STRIPE ', employers).id).toBe('e1')
    expect(resolveEmployerId('anthropic', employers)).toBe('e2')
  })
  it('returns null on a miss or empty input — never invents an employer', () => {
    expect(resolveEmployer('Stripe Inc', employers)).toBeNull()
    expect(resolveEmployerId('', employers)).toBeNull()
    expect(resolveEmployerId(null, employers)).toBeNull()
  })
  it('collects warm employer ids from contacts and applications', () => {
    const ids = warmEmployerIds({ contacts: [{ company: 'Stripe' }], apps: [{ company: 'anthropic' }, { company: 'Nope' }], employers })
    expect([...ids].sort()).toEqual(['e1', 'e2'])
  })
})
