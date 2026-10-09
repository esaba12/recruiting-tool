import { describe, it, expect } from 'vitest'
import { resumeStep, needsOnboarding, isFreshAccount, STEP_IDS } from '../src/lib/onboarding.js'
import { keyStatus } from '../src/lib/keyStatus.js'

describe('onboarding helpers', () => {
  it('resumes a saved step, restarting on unknown or missing values', () => {
    expect(resumeStep('gmail')).toBe('gmail')
    expect(resumeStep('renamed-step')).toBe(STEP_IDS[0])
    expect(resumeStep(null)).toBe('about')
  })
  it('gates on a loaded, never-onboarded profile only', () => {
    expect(needsOnboarding({ onboarded_at: null })).toBe(true)
    expect(needsOnboarding({ onboarded_at: '2026-10-09T00:00:00Z' })).toBe(false)
    expect(needsOnboarding(null)).toBe(false)   // profile failed to load → app, not wizard
  })
  it('stays in getting-started until there is at least one application and one contact', () => {
    expect(isFreshAccount({})).toBe(true)
    expect(isFreshAccount({ contacts: [{ id: 1 }] })).toBe(true)
    expect(isFreshAccount({ apps: [{ id: 2 }] })).toBe(true)
    expect(isFreshAccount({ contacts: [{ id: 1 }], apps: [{ id: 2 }] })).toBe(false)
  })
})

describe('keyStatus', () => {
  it('maps stored keys to ai/exa flags for the active provider', () => {
    expect(keyStatus({ loading: false, keys: { anthropic: true } })).toMatchObject({ ai: true, exa: false, aiProvider: 'anthropic' })
    expect(keyStatus({ loading: false, keys: { openai: true, exa: true } })).toMatchObject({ ai: false, exa: true })
    expect(keyStatus({ loading: false, keys: { openai: true } }, 'openai')).toMatchObject({ ai: true, aiProvider: 'openai' })
    expect(keyStatus({ loading: true, keys: {} })).toMatchObject({ loading: true, ai: false })
    // a failed status read fails open rather than locking out users who do have keys
    expect(keyStatus({ loading: false, unknown: true, keys: {} })).toMatchObject({ loading: false, ai: true, exa: true })
  })
})

describe('keyStore', () => {
  it('only blocks calls when a key is known to be missing', async () => {
    const { setKeyState, keyKnownMissing, assertKey, MissingKeyError } = await import('../src/lib/keyStore.js')
    setKeyState({ userId: 'u', loading: true, keys: {} })
    expect(keyKnownMissing('anthropic')).toBe(false)
    setKeyState({ userId: 'u', loading: false, unknown: true, keys: {} })
    expect(keyKnownMissing('anthropic')).toBe(false)
    setKeyState({ userId: 'u', loading: false, keys: { exa: true } })
    expect(keyKnownMissing('exa')).toBe(false)
    expect(() => assertKey('anthropic')).toThrow(MissingKeyError)
  })
})
