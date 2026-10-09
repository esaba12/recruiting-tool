import { describe, it, expect } from 'vitest'
import { normalizeProvider, envDefaultProvider, resolveProvider, keyProviderFor, providerLabel } from '../src/lib/aiProvider.js'

describe('aiProvider', () => {
  it('normalizes valid values and rejects junk', () => {
    expect(normalizeProvider('OpenAI')).toBe('openai')
    expect(normalizeProvider(' claude ')).toBe('claude')
    expect(normalizeProvider('gemini')).toBeNull()
    expect(normalizeProvider(null)).toBeNull()
    expect(normalizeProvider(undefined)).toBeNull()
  })
  it('env default falls back to claude', () => {
    expect(envDefaultProvider('openai')).toBe('openai')
    expect(envDefaultProvider('')).toBe('claude')
    expect(envDefaultProvider('nope')).toBe('claude')
  })
  it('user choice beats env; unset uses env', () => {
    expect(resolveProvider('claude', 'openai')).toBe('claude')
    expect(resolveProvider('openai', undefined)).toBe('openai')
    expect(resolveProvider(null, 'openai')).toBe('openai')
    expect(resolveProvider('bogus', undefined)).toBe('claude')
  })
  it('maps key slot and label', () => {
    expect(keyProviderFor('openai')).toBe('openai')
    expect(keyProviderFor('claude')).toBe('anthropic')
    expect(providerLabel('openai')).toBe('GPT')
    expect(providerLabel('claude')).toBe('Claude')
  })
})
