import { useEffect, useState } from 'react'
import Button from '../ui/Button.jsx'
import ResumeEditor from './ResumeEditor.jsx'
import AvailabilityEditor from './AvailabilityEditor.jsx'
import { getUserSetting, setUserSetting, saveResumeText } from '../../db.js'
import { AVAILABILITY_SETTING_KEY, defaultAvailability, normalizeAvailability } from '../../lib/availability.js'
import { AUTO_DRAFT_SETTING_KEY } from '../../lib/replyDrafts.js'

// Settings → Résumé and Drafted replies (v1.4 specs 09 + 10): the same editors as the
// onboarding Résumé and Calendar steps.
export default function DraftingSettings({ profile, refreshProfile, demoMode = false, hasAiKey = true }) {
  return (
    <>
      <ResumeSection profile={profile} refreshProfile={refreshProfile} demoMode={demoMode} />
      <RepliesSection demoMode={demoMode} hasAiKey={hasAiKey} />
    </>
  )
}

function ResumeSection({ profile, refreshProfile, demoMode }) {
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
          Drafted replies and cold outreach draw on it instead of guessing. Only the text is kept; the PDF never leaves your browser.
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

function RepliesSection({ demoMode, hasAiKey }) {
  const [autoDraft, setAutoDraft] = useState(true)
  const [availability, setAvailability] = useState(null) // null while loading
  const [savedAvailability, setSavedAvailability] = useState(null)
  const [offerTimes, setOfferTimes] = useState(false)
  const [state, setState] = useState(null)
  useEffect(() => {
    getUserSetting(AUTO_DRAFT_SETTING_KEY).then(v => setAutoDraft(v !== false)).catch(() => {})
    getUserSetting(AVAILABILITY_SETTING_KEY).then(v => {
      const a = normalizeAvailability(v)
      setSavedAvailability(a)
      setOfferTimes(!!a)
      setAvailability(a || defaultAvailability())
    }).catch(() => setAvailability(defaultAvailability()))
  }, [])

  async function toggleAutoDraft(on) {
    setAutoDraft(on)
    try { await setUserSetting(AUTO_DRAFT_SETTING_KEY, on) } catch (e) { setState(e.message); setAutoDraft(!on) }
  }
  async function saveAvailability() {
    setState('saving')
    const next = offerTimes ? normalizeAvailability(availability) : null
    try {
      await setUserSetting(AVAILABILITY_SETTING_KEY, next)
      setSavedAvailability(next)
      setState('saved')
    } catch (e) { setState(e.message) }
  }
  const dirty = JSON.stringify(offerTimes ? normalizeAvailability(availability) : null) !== JSON.stringify(savedAvailability)

  return (
    <section className="bg-surface rounded-2xl border border-ink-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Drafted replies</h3>
          <p className="text-xs text-ink-400">
            When a scanned email needs an answer (a recruiter asking for times, a contact writing back), a reply is drafted
            for you in Inbox. Nothing is ever sent for you.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-600 shrink-0 cursor-pointer">
          <input type="checkbox" checked={autoDraft} disabled={demoMode} onChange={e => toggleAutoDraft(e.target.checked)} />
          On
        </label>
      </div>
      {!demoMode && !hasAiKey && (
        <p className="text-[11px] text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-2.5 py-1.5">
          ⚠ Drafting uses your AI key, so add an Anthropic or OpenAI key above for drafts to start.
        </p>
      )}
      <div className="pt-3 border-t border-ink-100 space-y-3">
        <label className="flex items-center gap-2 text-xs font-medium text-ink-700 cursor-pointer">
          <input type="checkbox" checked={offerTimes} disabled={demoMode} onChange={e => { setOfferTimes(e.target.checked); setState(null) }} />
          Offer call times when someone asks to find a time
        </label>
        {!offerTimes && <p className="text-[11px] text-ink-400">Off: drafts ask them to suggest a few times instead.</p>}
        {offerTimes && availability && (
          <AvailabilityEditor value={availability} onChange={a => { setAvailability(a); setState(null) }} disabled={demoMode} />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={saveAvailability}
            disabled={demoMode || state === 'saving' || !dirty || (offerTimes && !normalizeAvailability(availability))}>
            {state === 'saving' ? 'Saving…' : 'Save call times'}
          </Button>
          {state === 'saved' && <span className="text-[11px] text-success-700">Saved</span>}
          {state && !['saving', 'saved'].includes(state) && <span className="text-[11px] text-danger-600">{state}</span>}
        </div>
      </div>
    </section>
  )
}
