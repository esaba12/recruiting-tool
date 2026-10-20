import { useEffect, useRef, useState } from 'react'
import { Check, ArrowRight, ArrowLeft, Mail, CalendarDays, X, Loader2, AlertTriangle, BellRing } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Mono from '../ui/Mono.jsx'
import GetAKey from './GetAKey.jsx'
import UnverifiedAppNote from './UnverifiedAppNote.jsx'
import ResumeEditor from './ResumeEditor.jsx'
import AvailabilityEditor from './AvailabilityEditor.jsx'
import { useAuth } from '../../lib/AuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import useKeyStatus from '../../lib/useKeyStatus.js'
import { TRACKS, profileTracks } from '../../lib/tracks.js'
import { connectGmail, connectGoogleCalendar, getGoogleCalendarStatus } from '../../lib/googleAuth.js'
import { fetchSchools, getUserSetting, setUserSetting, fetchTargetCompanies, saveTargetCompanies, addContact, fetchApplications, fetchContacts, saveResumeText } from '../../db.js'
import { AVAILABILITY_SETTING_KEY, defaultAvailability, normalizeAvailability } from '../../lib/availability.js'
import { resumeStep, STEP_IDS, STEP_SETTING_KEY, gmailSetupState, targetSuggestions, appendOnboardingLog, ONBOARDING_LOG_KEY } from '../../lib/onboarding.js'
import { useGmailScan } from '../../lib/gmailScan.js'
import { ImportPanel } from '../import/ImportPanel.jsx'

// First-run setup (v1.2 spec 02). AuthGate renders this instead of the app while
// profiles.onboarded_at is null. Only "About you" is required; every later step can be
// skipped. The current step is saved to user_settings before any OAuth redirect, so coming
// back from Google (the callbacks always redirect to "/") lands on the same step.
const STEPS = [
  { id: 'about',    title: 'About you',   blurb: 'So everything is tuned to what you\'re recruiting for.' },
  { id: 'resume',   title: 'Résumé',      blurb: 'Drafted replies and outreach draw on your real experience instead of guessing.' },
  { id: 'key',      title: 'AI key',      blurb: 'Powers extraction, drafting, and ranking. Bring your own key.' },
  { id: 'gmail',    title: 'Gmail',       blurb: 'The magic part: applications and contacts fill in from your inbox.' },
  { id: 'calendar', title: 'Calendar',    blurb: 'Interviews, OAs, recruiting events, and when you\'re free for calls.' },
  { id: 'data',     title: 'Your data',   blurb: 'Bring in the tracker and network you already have. No AI key needed.' },
  { id: 'done',     title: 'Ready',       blurb: '' },
]

const TARGET_HINTS = {
  swe: 'Stripe, Datadog, Ramp', pm: 'Notion, Figma, Duolingo', ib: 'Goldman Sachs, Evercore, Lazard',
  quant: 'Jane Street, Citadel, Optiver', consulting: 'McKinsey, Bain, BCG',
}

export default function OnboardingWizard() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [stepId, setStepId] = useState(null)
  const [imported, setImported] = useState({ apps: [], contacts: 0 }) // this session's imports, for targets + Ready
  const logRef = useRef(null)

  useEffect(() => {
    getUserSetting(STEP_SETTING_KEY).then(saved => setStepId(resumeStep(saved))).catch(() => setStepId('about'))
    getUserSetting(ONBOARDING_LOG_KEY).then(v => { logRef.current = v }).catch(() => {})
  }, [])

  // Every next/skip/back goes into user_settings.onboarding_log, so the owner can see which
  // steps people skip. Best-effort: a failed write never blocks the wizard.
  function record(action) {
    logRef.current = appendOnboardingLog(logRef.current, { step: stepId, action, at: new Date().toISOString() })
    setUserSetting(ONBOARDING_LOG_KEY, logRef.current).catch(() => {})
  }
  async function go(id) {
    setStepId(id)
    try { await setUserSetting(STEP_SETTING_KEY, id) } catch { /* resume is best-effort */ }
  }
  const idx = STEP_IDS.indexOf(stepId)
  const next = () => { record('next'); go(STEP_IDS[Math.min(idx + 1, STEP_IDS.length - 1)]) }
  const skip = () => { record('skip'); go(STEP_IDS[Math.min(idx + 1, STEP_IDS.length - 1)]) }
  const back = () => { record('back'); go(STEP_IDS[Math.max(idx - 1, 0)]) }

  async function finish({ openTab } = {}) {
    record('finish')
    // The app opens on the URL hash's tab (App.jsx hashTab), so a Ready-screen link can land there.
    if (openTab) window.history.replaceState(null, '', `#${openTab}`)
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id)
    try { await setUserSetting(STEP_SETTING_KEY, null) } catch { /* ignore */ }
    await refreshProfile()
  }

  if (!stepId) return <div className="min-h-screen bg-canvas" />
  const step = STEPS[idx]

  return (
    <div className="min-h-screen bg-canvas md:flex">
      {/* Step rail — desktop */}
      <aside className="hidden md:flex md:w-64 shrink-0 bg-ink-900 text-ink-100 flex-col p-6 theme-fixed">
        <p className="font-heading text-lg font-semibold text-white">Recruiting OS</p>
        <Mono className="text-ink-400 mt-1">SETUP · {String(idx + 1).padStart(2, '0')}/{String(STEPS.length).padStart(2, '0')}</Mono>
        <ol className="mt-8 space-y-1">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-3 px-2 py-2 text-sm border-l-2 ${
              i === idx ? 'border-accent-500 text-on-fill bg-ink-800' : i < idx ? 'border-ink-600 text-ink-300' : 'border-transparent text-ink-500'}`}>
              <Mono className={i === idx ? 'text-accent-400' : ''}>{String(i + 1).padStart(2, '0')}</Mono>
              {s.title}
            </li>
          ))}
        </ol>
        <button onClick={signOut} className="mt-auto text-xs text-ink-400 hover:text-white text-left">Sign out</button>
      </aside>

      {/* Progress — mobile */}
      <div className="md:hidden h-1 bg-ink-100">
        <div className="h-1 bg-accent-500 transition-all" style={{ width: `${((idx + 1) / STEPS.length) * 100}%` }} />
      </div>

      <main className="flex-1 px-4 py-8 md:px-12 md:py-14">
        <div key={step.id} className="max-w-xl">
          <Mono className="text-link learn-rise">STEP {String(idx + 1).padStart(2, '0')}</Mono>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-ink-900 mt-1 learn-rise" style={{ animationDelay: '40ms' }}>
            {step.id === 'done' ? 'You\'re set up.' : step.title}
          </h1>
          {step.blurb && <p className="text-sm text-ink-500 mt-1 learn-rise" style={{ animationDelay: '80ms' }}>{step.blurb}</p>}
          <div className="mt-6 learn-rise" style={{ animationDelay: '140ms' }}>
            {step.id === 'about'    && <AboutStep user={user} profile={profile} refreshProfile={refreshProfile} onNext={next} />}
            {step.id === 'resume'   && <ResumeStep profile={profile} refreshProfile={refreshProfile} onNext={next} onSkip={skip} onBack={back} />}
            {step.id === 'key'      && <KeyStep user={user} onNext={next} onSkip={skip} onBack={back} />}
            {step.id === 'gmail'    && <GmailStep user={user} onNext={next} onSkip={skip} onBack={back} />}
            {step.id === 'calendar' && <CalendarStep onNext={next} onSkip={skip} onBack={back} />}
            {step.id === 'data'     && <DataStep profile={profile} imported={imported} setImported={setImported} onNext={next} onSkip={skip} onBack={back} />}
            {step.id === 'done'     && <DoneStep user={user} profile={profile} imported={imported} onFinish={finish} onBack={back} />}
          </div>
          <button onClick={signOut} className="md:hidden mt-10 text-xs text-ink-400 hover:text-ink-700">Sign out</button>
        </div>
      </main>
    </div>
  )
}

function Nav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, skip }) {
  return (
    <div className="flex items-center gap-2 mt-8 pt-5 border-t border-ink-200">
      {onBack && <Button variant="ghost" size="sm" onClick={onBack} className="inline-flex items-center gap-1"><ArrowLeft size={13} /> Back</Button>}
      <div className="flex-1" />
      {skip && <Button variant="ghost" size="sm" onClick={skip}>Skip for now</Button>}
      <Button onClick={onNext} disabled={nextDisabled} className="inline-flex items-center gap-1.5">{nextLabel} <ArrowRight size={14} /></Button>
    </div>
  )
}

function AboutStep({ user, profile, refreshProfile, onNext }) {
  const [form, setForm] = useState(() => ({
    full_name: profile?.full_name || '',
    school: profile?.school || '',
    school_id: profile?.school_id || '',
    grad_year: profile?.grad_year || '',
    tracks: profile?.tracks?.length ? profileTracks(profile) : [],
  }))
  const [schools, setSchools] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => { fetchSchools().then(setSchools).catch(() => setSchools([])) }, [])

  const toggle = id => setForm(f => ({ ...f, tracks: f.tracks.includes(id) ? f.tracks.filter(t => t !== id) : [...f.tracks, id] }))

  async function save() {
    setBusy(true); setErr(null)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name || null,
      school: form.school || null,
      school_id: form.school_id || null,
      grad_year: form.grad_year ? Number(form.grad_year) : null,
      tracks: form.tracks,
    }).eq('id', user.id)
    setBusy(false)
    if (error) { setErr(error.message); return }
    await refreshProfile()
    onNext()
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 mb-2">What are you recruiting for?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-ink-300">
          {TRACKS.map(t => {
            const on = form.tracks.includes(t.id)
            return (
              <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on}
                className={`flex items-center justify-between text-left px-4 py-3 border-r border-b border-ink-300 transition-colors ${on ? 'bg-ink-900 text-on-fill' : 'bg-surface hover:bg-ink-50 text-ink-800'}`}>
                <span className="text-sm font-medium">{t.label}</span>
                <span className={`w-4 h-4 border flex items-center justify-center ${on ? 'bg-accent-500 border-accent-500' : 'border-ink-300'}`}>
                  {on && <Check size={11} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-ink-400 mt-1.5">Pick as many as apply. You can change this later in Settings.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input className="bg-surface" label="Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        <Input className="bg-surface" label="Grad year" type="number" placeholder="2028" value={form.grad_year} onChange={e => setForm(f => ({ ...f, grad_year: e.target.value }))} />
        <div className="sm:col-span-2">
          <Input className="bg-surface" label="School" list="onboarding-schools" value={form.school} placeholder="University of …"
            onChange={e => {
              const school = e.target.value
              const match = schools.find(s => s.name.toLowerCase() === school.trim().toLowerCase() || s.slug === school.trim().toLowerCase())
              setForm(f => ({ ...f, school, school_id: match ? match.id : '' }))
            }} />
          <datalist id="onboarding-schools">{schools.map(s => <option key={s.id} value={s.name} />)}</datalist>
          {form.school_id && <p className="text-[11px] text-success-700 mt-0.5">✓ Your campus's recruiting events will show up automatically.</p>}
        </div>
      </div>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onNext={save} nextDisabled={busy || !form.tracks.length} nextLabel={busy ? 'Saving…' : 'Continue'} />
    </div>
  )
}

// Résumé (v1.4 spec 09): the PDF is read in the browser and only its text is saved.
function ResumeStep({ profile, refreshProfile, onNext, onSkip, onBack }) {
  const [text, setText] = useState(profile?.resume_text || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function save() {
    setBusy(true); setErr(null)
    try {
      await saveResumeText(text)
      await refreshProfile()
      onNext()
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }
  return (
    <div>
      <ResumeEditor value={text} onChange={setText} disabled={busy} />
      <p className="text-[11px] text-ink-400 mt-3">
        Only the text is kept, on your account. The PDF never leaves your browser. Replace or remove it any time in Settings.
      </p>
      {err && <p className="text-xs text-danger-600 mt-2">{err}</p>}
      <Nav onBack={onBack} onNext={save} nextDisabled={busy || !text.trim()} nextLabel={busy ? 'Saving…' : 'Continue'} skip={onSkip} />
    </div>
  )
}

function KeyStep({ user, onNext, onSkip, onBack }) {
  const status = useKeyStatus(user?.id)
  return (
    <div>
      <GetAKey provider={status.aiProvider} hasKey={status.ai} />
      {!status.ai && !status.loading && (
        <p className="text-xs text-ink-500 mt-4">
          Skipping is fine: your pipeline, network, calendar, and manual logging all work without a key. AI buttons will
          show an "add a key" link until you do.
        </p>
      )}
      <Nav onBack={onBack} onNext={onNext} skip={status.ai ? null : onSkip} nextDisabled={!status.ai} />
    </div>
  )
}

function ConnectedRow({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 p-3 border border-success-200 bg-success-50 rounded-md text-sm text-success-800">
      <Icon size={15} /> <span className="font-mono text-xs">{label}</span> <Check size={14} strokeWidth={2.5} className="ml-auto" />
    </div>
  )
}

// After the OAuth redirect lands back here, the first scan starts right away (scan-mine)
// instead of waiting for the cron, and its progress shows on this step.
function GmailStep({ user, onNext, onSkip, onBack }) {
  const keys = useKeyStatus(user?.id)
  const scan = useGmailScan({ autoStart: true })
  const [err, setErr] = useState(null)
  const g = gmailSetupState({ connections: scan.connections, scanning: scan.scanning, anyAiKey: keys.anyAi, keyLoading: keys.loading })
  const connected = (scan.connections || []).length > 0
  return (
    <div className="space-y-4">
      {!keys.loading && !keys.anyAi && (
        <p className="text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-md p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Gmail needs an AI key to read your mail. Go back and add one, or connect now and it starts as soon as you do.</span>
        </p>
      )}
      {connected
        ? <>
            {scan.connections.map(c => <ConnectedRow key={c.email} icon={Mail} label={c.email} />)}
            <ScanStatus g={g} scan={scan} />
          </>
        : <>
            <p className="text-sm text-ink-600">
              Every ~10 minutes, recruiting and networking mail (application confirmations, OAs, interview invites,
              coffee-chat threads) gets turned into Pipeline rows, contacts, and to-dos. Without it, you'd log
              everything by hand.
            </p>
            <UnverifiedAppNote what="Gmail" />
            <Button variant="secondary" onClick={() => connectGmail().catch(e => setErr(e.message))} className="inline-flex items-center gap-2">
              <Mail size={14} /> Connect Gmail
            </Button>
          </>}
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onBack={onBack} onNext={onNext} skip={connected ? null : onSkip} nextDisabled={!connected} />
    </div>
  )
}

// One line on where the inbox scan is: shared by the Gmail step and the Ready screen.
function ScanStatus({ g, scan }) {
  if (g.kind === 'scanning') return (
    <p className="text-sm text-ink-600 flex items-center gap-2"><Loader2 size={14} className="animate-spin text-accent-600" />
      Reading your inbox (last 45 days). Applications and contacts appear as they're found.</p>
  )
  if (g.kind === 'waiting') return <p className="text-sm text-ink-600">First scan in progress. It finishes in the background over the next few minutes.</p>
  if (g.kind === 'done') return <p className="text-sm text-success-700 flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} /> Inbox scanned. New mail is checked every ~10 minutes.</p>
  if (g.kind === 'needsKey') return <p className="text-sm text-warning-800">Connected, waiting for an AI key before the first scan.</p>
  return scan.error ? <p className="text-xs text-danger-600">{scan.error}</p> : null
}

// Calendar, plus when you're open to calls (v1.4 spec 10). Availability is asked whether or
// not a calendar gets connected: drafted replies offer times inside it, skipping anything
// already on a connected calendar. Skipping the step leaves it unset.
function CalendarStep({ onNext, onSkip, onBack }) {
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState(null)
  const [offerTimes, setOfferTimes] = useState(true)
  const [availability, setAvailability] = useState(() => defaultAvailability())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getGoogleCalendarStatus('personal').then(setStatus).catch(() => setStatus({ connected: false }))
    getUserSetting(AVAILABILITY_SETTING_KEY).then(v => { if (v) setAvailability(v) }).catch(() => {})
  }, [])
  const valid = normalizeAvailability(availability)
  async function save() {
    setBusy(true); setErr(null)
    try {
      await setUserSetting(AVAILABILITY_SETTING_KEY, offerTimes ? valid : null)
      onNext()
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }
  return (
    <div className="space-y-4">
      {status?.connected
        ? <ConnectedRow icon={CalendarDays} label={status.email || 'Google Calendar'} />
        : <>
            <p className="text-sm text-ink-600">
              Turn a screenshot or pasted invite into a calendar event, see conflicts against career fairs, and get
              reminders for OA deadlines. You can add a separate school calendar later in Settings.
            </p>
            <UnverifiedAppNote what="Calendar" />
            <Button variant="secondary" onClick={() => connectGoogleCalendar('personal').catch(e => setErr(e.message))} className="inline-flex items-center gap-2">
              <CalendarDays size={14} /> Connect Google Calendar
            </Button>
          </>}
      <section className="pt-5 border-t border-ink-200">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 mb-1 cursor-pointer">
          <input type="checkbox" checked={offerTimes} onChange={e => setOfferTimes(e.target.checked)} />
          When are you free for calls?
        </label>
        <p className="text-xs text-ink-500 mb-3">
          When someone asks to find a time, the drafted reply offers three slots inside these hours.
          {status?.connected ? ' Anything already on your calendar is skipped.' : ' Connect a calendar and it skips anything already on it.'}
        </p>
        {offerTimes && <AvailabilityEditor value={availability} onChange={setAvailability} disabled={busy} />}
      </section>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onBack={onBack} onNext={save} skip={onSkip} nextLabel={busy ? 'Saving…' : 'Continue'}
        nextDisabled={busy || (offerTimes ? !valid : !status?.connected)} />
    </div>
  )
}

// Bring your data: the v1.4 spec 01 importers, then target companies pre-filled from the
// imported tracker. Replaced the old Targets step (three hand-typed people).
function DataStep({ profile, imported, setImported, onNext, onSkip, onBack }) {
  const [existing, setExisting] = useState({ apps: [], contacts: [] }) // e.g. what a first Gmail scan already found
  const [targets, setTargets] = useState([])
  const [removed, setRemoved] = useState([]) // suggestions the user took off, so they don't come back
  const [draft, setDraft] = useState('')
  const [people, setPeople] = useState([{ name: '', company: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => {
    fetchTargetCompanies().then(setTargets).catch(() => setTargets([]))
    Promise.all([fetchApplications(), fetchContacts()]).then(([apps, contacts]) => setExisting({ apps, contacts })).catch(() => {})
  }, [])
  // Each import adds its companies as target chips (newest applied first, capped).
  useEffect(() => {
    setTargets(t => [...t, ...targetSuggestions(imported.apps, [...t, ...removed])])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imported.apps])
  const hint = profileTracks(profile).map(t => TARGET_HINTS[t]).filter(Boolean)[0]

  function addTargets(text) {
    const names = text.split(',').map(s => s.trim()).filter(Boolean)
    setTargets(t => [...t, ...names.filter(n => !t.some(x => x.toLowerCase() === n.toLowerCase()))])
    setDraft('')
  }
  function removeTarget(t) {
    setTargets(ts => ts.filter(x => x !== t))
    setRemoved(r => [...r, t])
  }

  async function save() {
    setBusy(true); setErr(null)
    try {
      const pending = draft.trim() ? [...targets, ...draft.split(',').map(s => s.trim()).filter(Boolean)] : targets
      await saveTargetCompanies([...new Set(pending)])
      for (const p of people.filter(p => p.name.trim())) await addContact({ name: p.name.trim(), company: p.company.trim() })
      onNext()
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const label = 'text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 mb-2'
  const anything = targets.length || draft.trim() || people.some(p => p.name.trim()) || imported.apps.length || imported.contacts
  return (
    <div className="space-y-7">
      <section>
        <p className={label}>Application tracker (optional)</p>
        <ImportPanel kind="tracker" compact apps={existing.apps}
          onImported={(_n, rows) => setImported(i => ({ ...i, apps: [...i.apps, ...rows] }))} />
      </section>
      <section>
        <p className={label}>LinkedIn connections (optional)</p>
        <ImportPanel kind="linkedin" compact contacts={existing.contacts}
          onImported={n => setImported(i => ({ ...i, contacts: i.contacts + n }))} />
      </section>
      <section>
        <p className={label}>Target companies</p>
        <div className="flex gap-2">
          <Input className="bg-surface" value={draft} onChange={e => setDraft(e.target.value)} placeholder={hint ? `e.g. ${hint}` : 'Company names, comma-separated'}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); addTargets(draft) } }} />
          <Button variant="secondary" size="sm" onClick={() => addTargets(draft)} disabled={!draft.trim()}>Add</Button>
        </div>
        {targets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {targets.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-ink-900 text-on-fill rounded-sm">
                {t}
                <button onClick={() => removeTarget(t)} aria-label={`Remove ${t}`} className="text-ink-300 hover:text-white"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-ink-400 mt-1.5">
          {imported.apps.length ? 'Filled in from your tracker; remove any you\'re not chasing. ' : ''}
          Grow uses these to show where you have no contacts yet, then finds people to reach out to.
        </p>
      </section>
      {imported.contacts === 0 && (
        <section>
          <p className={label}>People you already know (optional)</p>
          <div className="space-y-2">
            {people.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <Input className="bg-surface" placeholder="Name" value={p.name} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                <Input className="bg-surface" placeholder="Company" value={p.company} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
              </div>
            ))}
          </div>
          {people.length < 3 && (
            <button onClick={() => setPeople(ps => [...ps, { name: '', company: '' }])} className="text-xs text-link hover:underline mt-2">+ another person</button>
          )}
        </section>
      )}
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onBack={onBack} onNext={save} nextDisabled={busy || !anything} nextLabel={busy ? 'Saving…' : 'Continue'} skip={onSkip} />
    </div>
  )
}

function DoneStep({ user, profile, imported, onFinish, onBack }) {
  const status = useKeyStatus(user?.id)
  const scan = useGmailScan()
  const [cal, setCal] = useState(null)
  const [callTimes, setCallTimes] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getGoogleCalendarStatus('personal').then(s => setCal(!!s.connected)).catch(() => setCal(false))
    getUserSetting(AVAILABILITY_SETTING_KEY).then(v => setCallTimes(!!normalizeAvailability(v))).catch(() => setCallTimes(false))
  }, [])
  const g = gmailSetupState({ connections: scan.connections, scanning: scan.scanning, anyAiKey: status.anyAi, keyLoading: status.loading })
  const gmailOn = g.kind === 'loading' ? null : ['scanning', 'waiting', 'done'].includes(g.kind)
  const rows = [
    { label: 'AI features', on: status.loading ? null : status.ai, off: 'Off: add a key in Settings anytime' },
    { label: 'Gmail auto-tracking', on: gmailOn, off: g.kind === 'needsKey' ? 'Connected, waiting for an AI key' : 'Off: connect in Settings anytime' },
    { label: 'Google Calendar', on: cal, off: 'Off: connect in Settings anytime' },
    { label: 'Résumé', on: !!profile?.resume_text, off: 'Not added: add it in Settings anytime' },
    { label: 'Call times in drafted replies', on: callTimes, off: 'Not set: drafts ask them for times instead' },
  ]
  const done = async opts => { setBusy(true); await onFinish(opts) }
  return (
    <div>
      <div className="border-t border-l border-ink-200">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3 border-r border-b border-ink-200 bg-surface text-sm">
            <span className="text-ink-800">{r.label}</span>
            {r.on == null ? <Mono className="text-ink-300">…</Mono>
              : r.on ? <Mono className="text-success-700">ON</Mono>
              : <span className="text-xs text-ink-400">{r.off}</span>}
          </div>
        ))}
      </div>
      {(imported.apps.length > 0 || imported.contacts > 0) && (
        <p className="text-sm text-ink-700 mt-4">
          Imported
          {imported.apps.length > 0 && <> <Mono>{imported.apps.length}</Mono> applications</>}
          {imported.apps.length > 0 && imported.contacts > 0 && ' and'}
          {imported.contacts > 0 && <> <Mono>{imported.contacts}</Mono> connections</>}.
        </p>
      )}
      {['scanning', 'waiting'].includes(g.kind) && <div className="mt-3"><ScanStatus g={g} scan={scan} /></div>}
      <button onClick={() => done({ openTab: 'settings' })} disabled={busy}
        className="mt-4 flex items-start gap-2 text-left text-sm text-ink-700 hover:text-ink-900 group">
        <BellRing size={15} className="mt-0.5 text-accent-600 shrink-0" />
        <span>Want a phone alert the moment an OA or interview invite lands? <span className="text-link group-hover:underline">Set up push notifications in Settings</span></span>
      </button>
      {user?.email?.endsWith('@byok.local') && (
        <p className="text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-md p-3 mt-4">
          You signed in with an API key, so that key is currently your only way back in. Settings → "Secure your account"
          lets you link Google or set a password.
        </p>
      )}
      <Nav onBack={onBack} onNext={() => done()} nextDisabled={busy} nextLabel="Go to Today" />
    </div>
  )
}
