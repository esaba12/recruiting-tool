import { describe, it, expect } from 'vitest'
import { resumeStep, needsOnboarding, isFreshAccount, STEP_IDS, gmailSetupState, targetSuggestions, appendOnboardingLog, ONBOARDING_LOG_MAX } from '../src/lib/onboarding.js'
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

// v1.4 spec 07: onboarding that ends with data on screen.
describe('onboarding v1.4', () => {
  it('maps the old Targets step to the new data step', () => {
    expect(STEP_IDS).toContain('data')
    expect(resumeStep('seed')).toBe('data')
  })

  it('asks for a résumé right after About you (v1.4 spec 09)', () => {
    expect(STEP_IDS.slice(0, 3)).toEqual(['about', 'resume', 'key'])
    expect(resumeStep('resume')).toBe('resume')
    expect(resumeStep('key')).toBe('key') // someone parked on a later step stays there
  })

  it('gmailSetupState: none / needs a key / scanning / waiting / done', () => {
    const never = [{ email: 'a@x.com', lastScannedAt: null }]
    const done = [{ email: 'a@x.com', lastScannedAt: '2026-10-19T10:00:00Z' }]
    expect(gmailSetupState({ connections: [], anyAiKey: true }).kind).toBe('none')
    expect(gmailSetupState({ connections: null, anyAiKey: true }).kind).toBe('loading')
    expect(gmailSetupState({ connections: never, anyAiKey: false }).kind).toBe('needsKey')
    expect(gmailSetupState({ connections: never, anyAiKey: true, scanning: true }).kind).toBe('scanning')
    expect(gmailSetupState({ connections: never, anyAiKey: true }).kind).toBe('waiting')
    expect(gmailSetupState({ connections: done, anyAiKey: true })).toMatchObject({ kind: 'done', emails: ['a@x.com'] })
    // A key status that's still loading never claims the key is missing.
    expect(gmailSetupState({ connections: never, anyAiKey: false, keyLoading: true }).kind).toBe('waiting')
  })

  it('targetSuggestions: companies from imported apps, most recent first, deduped, capped', () => {
    const apps = [
      { company: 'Evercore', appliedDate: '2026-09-10' },
      { company: 'Goldman Sachs', appliedDate: '2026-09-03' },
      { company: 'goldman sachs ', appliedDate: '2026-09-12' },
      { company: 'Lazard', appliedDate: null },
      ...Array.from({ length: 20 }, (_, i) => ({ company: `Co ${i}`, appliedDate: '2026-01-01' })),
    ]
    const out = targetSuggestions(apps, ['Evercore'])
    // Newest applied date first (the 9/12 Goldman row, trimmed); undated rows sort last.
    expect(out[0]).toBe('goldman sachs')
    expect(out[1]).toBe('Co 0')
    expect(out).not.toContain('Evercore') // already a target
    expect(out.filter(c => c.toLowerCase() === 'goldman sachs')).toHaveLength(1)
    expect(out).toHaveLength(15)
    expect(out).not.toContain('Lazard') // undated, so past the cap
  })

  it('appendOnboardingLog appends and caps', () => {
    let log = null
    for (let i = 0; i < ONBOARDING_LOG_MAX + 5; i++) log = appendOnboardingLog(log, { step: 'key', action: 'skip', at: i })
    expect(log).toHaveLength(ONBOARDING_LOG_MAX)
    expect(log.at(-1).at).toBe(ONBOARDING_LOG_MAX + 4)
  })
})
