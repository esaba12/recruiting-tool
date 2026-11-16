import { useEffect, useState } from 'react'
import Button from '../ui/Button.jsx'
import ResumeEditor from './ResumeEditor.jsx'
import { saveResumeText } from '../../db.js'

// Settings → Résumé (v1.4 spec 09): the same editor as the onboarding Résumé step.
export default function DraftingSettings({ profile, refreshProfile, demoMode = false }) {
  const saved = profile?.resume_text || ''
  const [text, setText] = useState(saved)
  const [state, setState] = useState(null) // 'saving' | 'saved' | error message
  useEffect(() => { setText(profile?.resume_text || '') }, [profile?.resume_text])

  async function save(next) {
    setState('saving')
    try {
      await saveResumeText(next)
      await refreshProfile?.()
      setText(next)
      setState('saved')
    } catch (e) { setState(e.message) }
  }

  return (
    <section className="bg-surface rounded-2xl border border-ink-100 p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">Résumé</h3>
        <p className="text-xs text-ink-400">
          Outreach drafts draw on it instead of guessing. Only the text is kept; the PDF never leaves your browser.
          {profile?.resume_updated_at && ` Updated ${new Date(profile.resume_updated_at).toLocaleDateString()}.`}
        </p>
      </div>
      <ResumeEditor value={text} onChange={t => { setText(t); setState(null) }} disabled={demoMode || state === 'saving'} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => save(text)} disabled={demoMode || state === 'saving' || text.trim() === saved.trim()}>
          {state === 'saving' ? 'Saving…' : 'Save résumé'}
        </Button>
        {saved && <Button size="sm" variant="ghost" onClick={() => save('')} disabled={demoMode || state === 'saving'}>Remove</Button>}
        {state === 'saved' && <span className="text-[11px] text-success-700">Saved</span>}
        {state && !['saving', 'saved'].includes(state) && <span className="text-[11px] text-danger-600">{state}</span>}
      </div>
    </section>
  )
}
