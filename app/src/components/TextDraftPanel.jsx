import { useState } from 'react'
import { draftMessage, escalationTier } from '../lib/drafting.js'
import { useAuth } from '../lib/AuthContext.jsx'

// Sibling to DraftPanel.jsx, scoped to text-message follow-ups: shorter/casual generation
// (kind: 'text_follow_up', see lib/drafting.js), and instead of "Save to Notion"
// persistence, hands off to the OS's Messages app via an sms: link — same mailto:-style
// device handoff every other quick-link in this app already relies on. A text follow-up
// is a one-off nudge, not a record worth persisting onto the contact the way an email
// draft is, so this deliberately never writes back to the contact row.
export default function TextDraftPanel({ contact, daysOverdue = 0 }) {
  const { profile } = useAuth()
  const tier = escalationTier(daysOverdue)
  const [draft, setDraft] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setGenerating(true); setError(null)
    try {
      const result = await draftMessage({ contact, kind: 'text_follow_up', tier, profile })
      setDraft(result.draft)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-accent-50 border border-accent-100 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-accent-700">Text Follow-Up (tier {tier}/3)</p>
        {draft && (
          <button onClick={() => navigator.clipboard.writeText(draft)} className="text-xs text-accent-500 hover:underline">Copy</button>
        )}
      </div>

      {error && <div className="p-2 mb-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}

      {draft ? (
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2}
          className="w-full px-2.5 py-1.5 border border-accent-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none bg-white" />
      ) : (
        <button onClick={generate} disabled={generating}
          className="w-full py-2 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 disabled:opacity-40 font-medium">
          {generating ? 'Drafting...' : 'Generate draft →'}
        </button>
      )}

      {draft && (
        <div className="flex items-center gap-2 mt-2">
          <button onClick={generate} disabled={generating}
            className="px-3 py-1.5 bg-white border border-accent-200 rounded-lg text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
            {generating ? 'Regenerating...' : 'Regenerate'}
          </button>
          <a href={`sms:${contact.phone}?&body=${encodeURIComponent(draft)}`}
            className="px-3 py-1.5 bg-accent-600 text-white rounded-lg text-xs font-medium hover:bg-accent-700">
            Open in Messages →
          </a>
        </div>
      )}
    </div>
  )
}
