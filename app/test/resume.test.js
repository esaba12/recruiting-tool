import { describe, it, expect } from 'vitest'
import { normalizeResumeText, resumePromptBlock, RESUME_MAX_CHARS, RESUME_PROMPT_CHARS } from '../src/lib/resume.js'

describe('normalizeResumeText', () => {
  it('collapses spacing, drops page numbers and extra blank lines', () => {
    const raw = 'Jane   Doe\r\n\r\n\r\n\r\nEducation\t\tUniversity\n1\nPage 2 of 3\n2/3\nExperience Acme'
    expect(normalizeResumeText(raw)).toBe('Jane Doe\n\nEducation University\nExperience Acme')
  })

  it('keeps lines that merely contain numbers', () => {
    expect(normalizeResumeText('GPA 3.9\n2024 – 2028')).toBe('GPA 3.9\n2024 – 2028')
  })

  it('caps the length and handles empty input', () => {
    expect(normalizeResumeText('x'.repeat(RESUME_MAX_CHARS + 50))).toHaveLength(RESUME_MAX_CHARS)
    expect(normalizeResumeText(null)).toBe('')
  })
})

describe('resumePromptBlock', () => {
  it('is empty without a résumé', () => {
    expect(resumePromptBlock('')).toBe('')
    expect(resumePromptBlock('   ')).toBe('')
    expect(resumePromptBlock(null)).toBe('')
  })

  it('includes the text and a no-invention rule', () => {
    const block = resumePromptBlock('SWE intern at Acme')
    expect(block).toContain('SWE intern at Acme')
    expect(block).toContain('never invent')
  })

  it('truncates long résumés', () => {
    const block = resumePromptBlock('a'.repeat(RESUME_PROMPT_CHARS + 100))
    expect(block).toContain('[…truncated]')
    expect(block.match(/a{10,}/)[0]).toHaveLength(RESUME_PROMPT_CHARS)
  })
})
