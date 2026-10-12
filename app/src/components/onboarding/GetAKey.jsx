import { useState } from 'react'
import { ExternalLink, KeyRound, Check } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Mono from '../ui/Mono.jsx'
import { authHeader } from '../../lib/supabaseClient.js'
import { refreshKeyStatus } from '../../lib/useKeyStatus.js'

// Guided "get an AI key" walkthrough + paste box — shared by the onboarding wizard's key
// step and Settings. Every AI feature runs on the user's own key (BYOK, see CLAUDE.md);
// most friends won't have one, so this spells out the exact clicks.
const PROVIDER_STEPS = {
  anthropic: {
    label: 'Anthropic (Claude)',
    placeholder: 'sk-ant-...',
    steps: [
      { text: 'Create an account at the Anthropic Console', href: 'https://console.anthropic.com/' },
      { text: 'Billing → add a small amount of credit (e.g. $5)', href: 'https://console.anthropic.com/settings/billing' },
      { text: 'API Keys → Create key → copy it', href: 'https://console.anthropic.com/settings/keys' },
    ],
  },
  openai: {
    label: 'OpenAI',
    placeholder: 'sk-...',
    steps: [
      { text: 'Sign in to the OpenAI platform', href: 'https://platform.openai.com/' },
      { text: 'Billing → add a small amount of credit', href: 'https://platform.openai.com/settings/organization/billing' },
      { text: 'API keys → Create new secret key → copy it', href: 'https://platform.openai.com/api-keys' },
    ],
  },
}

export async function saveApiKey(provider, apiKey) {
  const res = await fetch('/api/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ provider, apiKey }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error?.message || 'Failed to save key')
  await refreshKeyStatus()
}

// stepsOnly: just the numbered walkthrough (Settings has its own paste fields).
export default function GetAKey({ provider = 'anthropic', hasKey = false, onSaved, stepsOnly = false }) {
  const p = PROVIDER_STEPS[provider] || PROVIDER_STEPS.anthropic
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function save(e) {
    e.preventDefault()
    if (!key.trim()) return
    setBusy(true); setErr(null)
    try { await saveApiKey(provider, key.trim()); setKey(''); onSaved?.() }
    catch (e2) { setErr(e2.message) }
    finally { setBusy(false) }
  }

  if (hasKey) {
    return (
      <div className="flex items-center gap-2 p-3 border border-success-200 bg-success-50 rounded-md text-sm text-success-800">
        <Check size={15} strokeWidth={2.5} /> {p.label} key saved — AI features are on.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="border-t border-l border-ink-200">
        {p.steps.map((s, i) => (
          <li key={i} className="flex items-center gap-3 border-r border-b border-ink-200 px-3 py-2.5 bg-white">
            <Mono className="text-accent-600 text-xs w-5">{String(i + 1).padStart(2, '0')}</Mono>
            <a href={s.href} target="_blank" rel="noreferrer"
              className="flex-1 text-sm text-ink-700 hover:text-accent-700 inline-flex items-center gap-1.5">
              {s.text} <ExternalLink size={12} className="text-ink-300" />
            </a>
          </li>
        ))}
      </ol>
      {!stepsOnly && <>
      <form onSubmit={save} className="flex gap-2">
        <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={p.placeholder}
          className="font-mono text-xs bg-white" autoComplete="off" aria-label={`${p.label} API key`} />
        <Button type="submit" size="sm" disabled={busy || !key.trim()} className="whitespace-nowrap inline-flex items-center gap-1.5">
          <KeyRound size={13} /> {busy ? 'Saving…' : 'Save key'}
        </Button>
      </form>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <p className="text-[11px] text-ink-400 leading-relaxed">
        You pay {p.label.split(' ')[0]} directly for what you use; this app sticks to their cheaper models for most calls.
        Your key is encrypted before it's stored and is never shown back to anyone, including you.
      </p>
      </>}
    </div>
  )
}
