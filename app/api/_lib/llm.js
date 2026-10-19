import { getUserKey } from './keys.js'

// Server-side text→JSON calls on the user's own BYOK key, for the code that runs with no
// browser (the Gmail scan and the push recap). The server-side twin of src/lib/ai.js: same
// provider choice (profiles.ai_provider), same tiers, same OpenAI request shape
// (max_completion_tokens + json_object). Unlike the client, it falls back to whichever key
// the user does have, since a background scan has no UI to ask them to switch.

export const SERVER_MODELS = {
  anthropic: { mini: 'claude-haiku-4-5-20251001', standard: 'claude-sonnet-4-6' },
  openai:    { mini: 'gpt-5-mini', standard: 'gpt-5.1' },
}

// aiProvider: profiles.ai_provider ('claude' | 'openai' | null). keys: { anthropic?, openai? }.
export function pickLlm(aiProvider, keys) {
  const order = aiProvider === 'openai' ? ['openai', 'anthropic'] : ['anthropic', 'openai']
  const provider = order.find(p => keys[p])
  return provider ? { provider, apiKey: keys[provider] } : null
}

// The user's { provider, apiKey }, or null when they have neither key.
export async function llmForUser(userId, aiProvider) {
  const [anthropic, openai] = await Promise.all([getUserKey(userId, 'anthropic'), getUserKey(userId, 'openai')])
  return pickLlm(aiProvider, { anthropic, openai })
}

export async function completeJSON(llm, { tier = 'mini', prompt, maxTokens = 1000, fetch = globalThis.fetch }) {
  const model = SERVER_MODELS[llm.provider][tier]
  const res = llm.provider === 'openai'
    ? await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { authorization: `Bearer ${llm.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_completion_tokens: maxTokens, response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      })
    : await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': llm.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      })
  const label = llm.provider === 'openai' ? 'OpenAI' : 'Claude'
  if (!res.ok) throw new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const text = llm.provider === 'openai' ? json.choices?.[0]?.message?.content || '' : json.content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in ${label} response`)
  return JSON.parse(match[0])
}
