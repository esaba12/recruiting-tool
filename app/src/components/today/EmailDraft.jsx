import { useState } from 'react'
import { draftMessage } from '../../lib/drafting.js'
import { aiProviderLabel } from '../../lib/ai.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import NeedsKey from '../onboarding/NeedsKey.jsx'

// An email to edit and send yourself: thank-yous (v1.4 spec 03) and expedite asks (spec 04).
// It opens on a plain template, so it works with no key; with one, the AI rewrites it around
// `context`. Nothing is saved and nothing sends.
export default function EmailDraft({ contact, kind, context, initialText, initialSubject, label }) {
  const { profile } = useAuth()
  const [text, setText] = useState(initialText)
  const [subject, setSubject] = useState(initialSubject)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function rewrite() {
    setGenerating(true); setError(null)
    try {
      const result = await draftMessage({ contact, kind, personalizationContext: context, profile })
      setText(result.draft)
      if (result.subjectLine) setSubject(result.subjectLine)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const email = contact?.email
  return (
    <div className="bg-accent-50 border border-accent-100 rounded-md p-3 mt-2 space-y-2">
      {error && <p className="text-xs text-danger-700">{error}</p>}
      <input value={subject} onChange={e => setSubject(e.target.value)} aria-label="Subject"
        className="w-full px-2.5 py-1.5 border border-accent-200 rounded-md text-sm bg-surface focus:outline-none focus:border-accent-400" />
      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} aria-label={label}
        className="w-full px-2.5 py-1.5 border border-accent-200 rounded-md text-sm bg-surface resize-y focus:outline-none focus:border-accent-400" />
      <div className="flex items-center gap-3 flex-wrap">
        <NeedsKey kind="ai">
          <button onClick={rewrite} disabled={generating}
            className="px-3 py-1.5 bg-surface border border-accent-200 rounded-md text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
            {generating ? 'Writing…' : `Rewrite with ${aiProviderLabel()}`}
          </button>
        </NeedsKey>
        <button onClick={() => navigator.clipboard.writeText(text)} className="text-xs text-link hover:underline">Copy</button>
        {email && (
          <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`}
            className="text-xs text-link hover:underline">Open in email ↗</a>
        )}
      </div>
    </div>
  )
}
