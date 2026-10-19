import { describe, it, expect, vi } from 'vitest'
vi.mock('../api/_lib/supabaseAdmin.js', () => ({ supabaseAdmin: () => ({}) }))
import { pickLlm, completeJSON, SERVER_MODELS } from '../api/_lib/llm.js'

// v1.4 spec 06 B: the serverless Gmail scan and recap used to require an Anthropic key, so a
// user who picked OpenAI connected Gmail and got nothing.

describe('pickLlm', () => {
  it('uses the provider the user picked when they have that key', () => {
    expect(pickLlm('openai', { anthropic: 'a', openai: 'o' })).toEqual({ provider: 'openai', apiKey: 'o' })
    expect(pickLlm('claude', { anthropic: 'a', openai: 'o' })).toEqual({ provider: 'anthropic', apiKey: 'a' })
  })

  it('falls back to the other key when the picked one is missing', () => {
    expect(pickLlm('openai', { anthropic: 'a' })).toEqual({ provider: 'anthropic', apiKey: 'a' })
    expect(pickLlm('claude', { openai: 'o' })).toEqual({ provider: 'openai', apiKey: 'o' })
    expect(pickLlm(null, { openai: 'o' })).toEqual({ provider: 'openai', apiKey: 'o' })
  })

  it('is null with neither key', () => {
    expect(pickLlm('claude', {})).toBeNull()
  })
})

const okJson = body => ({ ok: true, json: async () => body })

describe('completeJSON', () => {
  it('calls Anthropic with the tier model and parses the JSON out of the text', async () => {
    const fetch = vi.fn(async () => okJson({ content: [{ text: 'Sure: {"type":"OFFER"}' }] }))
    const out = await completeJSON({ provider: 'anthropic', apiKey: 'k' }, { tier: 'mini', prompt: 'p', maxTokens: 700, fetch })
    expect(out).toEqual({ type: 'OFFER' })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('k')
    expect(JSON.parse(init.body)).toMatchObject({ model: SERVER_MODELS.anthropic.mini, max_tokens: 700 })
  })

  it('calls OpenAI chat completions in JSON mode', async () => {
    const fetch = vi.fn(async () => okJson({ choices: [{ message: { content: '{"summary":"x","todos":[]}' } }] }))
    const out = await completeJSON({ provider: 'openai', apiKey: 'k' }, { tier: 'standard', prompt: 'p', maxTokens: 800, fetch })
    expect(out).toEqual({ summary: 'x', todos: [] })
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.authorization).toBe('Bearer k')
    expect(JSON.parse(init.body)).toMatchObject({
      model: SERVER_MODELS.openai.standard, max_completion_tokens: 800, response_format: { type: 'json_object' },
    })
  })

  it('throws on an HTTP error and on a reply with no JSON', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 401, text: async () => 'nope' }))
    await expect(completeJSON({ provider: 'openai', apiKey: 'k' }, { tier: 'mini', prompt: 'p', fetch: bad })).rejects.toThrow('401')
    const noJson = vi.fn(async () => okJson({ content: [{ text: 'no json here' }] }))
    await expect(completeJSON({ provider: 'anthropic', apiKey: 'k' }, { tier: 'mini', prompt: 'p', fetch: noJson })).rejects.toThrow('No JSON')
  })
})
