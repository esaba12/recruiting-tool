import { describe, it, expect } from 'vitest'
import { CLAUDE_MODELS, claudeRequestBody, readClaudeText } from '../src/lib/claudeRequest.js'

// Claude 5.5 generation (2026-11-27): Haiku 5.5 thinks by default and Sonnet 5.5 rejects
// `disabled`, so every request states its thinking setting, and replies are read by block type.

describe('claudeRequestBody', () => {
  it('uses the 5.5 models', () => {
    expect(CLAUDE_MODELS).toEqual({ HAIKU: 'claude-haiku-5-5', SONNET: 'claude-sonnet-5-5' })
  })
  it('turns thinking off on Haiku at low effort', () => {
    expect(claudeRequestBody({ model: CLAUDE_MODELS.HAIKU, content: 'hi', maxTokens: 150 })).toEqual({
      model: 'claude-haiku-5-5', max_tokens: 150, messages: [{ role: 'user', content: 'hi' }],
      thinking: { type: 'disabled' }, output_config: { effort: 'low' },
    })
  })
  it('turns thinking off on Sonnet with between_tools and nothing else inside thinking', () => {
    const body = claudeRequestBody({ model: CLAUDE_MODELS.SONNET, content: [{ type: 'text', text: 'x' }], maxTokens: 500 })
    expect(body.thinking).toEqual({ type: 'between_tools' })
    expect(body.output_config).toBeUndefined()
    expect(body.messages).toEqual([{ role: 'user', content: [{ type: 'text', text: 'x' }] }])
  })
  it('sends no thinking field for a model it has no rule for', () => {
    expect(claudeRequestBody({ model: 'claude-other', content: 'x', maxTokens: 10 }).thinking).toBeUndefined()
  })
})

describe('readClaudeText', () => {
  it('reads the text block even when thinking blocks come first', () => {
    expect(readClaudeText({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: '{"a":1}' }] })).toBe('{"a":1}')
  })
  it('joins several text blocks', () => {
    expect(readClaudeText({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] })).toBe('ab')
  })
  it('throws a clear error on a refusal', () => {
    expect(() => readClaudeText({ stop_reason: 'refusal', content: [] })).toThrow('Claude declined this request')
  })
  it('is empty when there is no text', () => {
    expect(readClaudeText({ content: [] })).toBe('')
    expect(readClaudeText({})).toBe('')
  })
})
