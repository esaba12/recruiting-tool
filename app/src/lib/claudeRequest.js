// The Claude request and reply shape, shared by the browser client (lib/claude.js, through the
// /claude-api proxy) and the server (api/_lib/llm.js: Gmail scan, push recap). Pure, so the
// server imports it the way api/_lib/eventsContribute.js imports lib/ingest.
//
// Claude 5.5 generation (2026-11-27). Both models break the 4.x shape:
// - Haiku 5.5 thinks by default, and thinking counts toward max_tokens, which would eat the
//   small caps (150–3000) the classifiers use. `disabled` is only accepted at effort ≤ high.
// - Sonnet 5.5 rejects `disabled`; `between_tools` is its no-thinking setting and must be the
//   only field inside `thinking`. These calls use no tools, so it means no thinking at all.
// - A reply can start with `thinking` blocks, so text is read by block type, never content[0].
// - A safety decline is HTTP 200 with stop_reason 'refusal' and no text.

export const CLAUDE_MODELS = {
  HAIKU: 'claude-haiku-5-5',
  SONNET: 'claude-sonnet-5-5',
}

const THINKING_OFF = {
  [CLAUDE_MODELS.HAIKU]: { thinking: { type: 'disabled' }, output_config: { effort: 'low' } },
  [CLAUDE_MODELS.SONNET]: { thinking: { type: 'between_tools' } },
}

// content: a plain string, or a content-block array (vision sends [{type:'image'…}, {type:'text'…}]).
export function claudeRequestBody({ model, content, maxTokens }) {
  return { model, max_tokens: maxTokens, messages: [{ role: 'user', content }], ...THINKING_OFF[model] }
}

export function readClaudeText(data) {
  if (data?.stop_reason === 'refusal') throw new Error('Claude declined this request')
  return (data?.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
}
