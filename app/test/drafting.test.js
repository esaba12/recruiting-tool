import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { buildDraftPrompt } = await import('../src/lib/drafting.js')

const contact = { name: 'Jane Doe', company: 'Acme', role: 'Recruiter', lifeDomain: [] }

describe('buildDraftPrompt — text_follow_up', () => {
  it('asks for a short, casual, subject-line-free draft', () => {
    const prompt = buildDraftPrompt({ contact, kind: 'text_follow_up', tier: 1, profile: {} })
    expect(prompt).toContain('text message')
    expect(prompt).toContain('under 30 words')
    expect(prompt).toContain('"subjectLine": null')
  })

  it('includes tier-specific tone guidance, same as follow_up', () => {
    const prompt = buildDraftPrompt({ contact, kind: 'text_follow_up', tier: 3, profile: {} })
    expect(prompt).toContain('follow-up tier 3 of 3')
    expect(prompt).toContain('easy out')
  })

  it('does not require personalizationContext (unlike cold_open)', () => {
    expect(() => buildDraftPrompt({ contact, kind: 'text_follow_up', tier: 1, profile: {} })).not.toThrow()
  })
})

describe('buildDraftPrompt — résumé (v1.4 spec 09)', () => {
  const profile = { school: 'State U', tracks: ['swe'], resume_text: 'SWE intern at Acme, built the billing pipeline' }
  it('cold opens draw on the résumé', () => {
    const prompt = buildDraftPrompt({ contact, kind: 'cold_open', personalizationContext: 'Same school', profile })
    expect(prompt).toContain('billing pipeline')
  })
  it('leaves it out for personal contacts and follow-ups', () => {
    const friend = { ...contact, lifeDomain: ['Friend'] }
    expect(buildDraftPrompt({ contact: friend, kind: 'cold_open', personalizationContext: 'x', profile })).not.toContain('billing pipeline')
    expect(buildDraftPrompt({ contact, kind: 'follow_up', tier: 1, profile })).not.toContain('billing pipeline')
  })
})
