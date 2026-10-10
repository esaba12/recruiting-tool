import { useEffect, useState } from 'react'
import { Check, ArrowRight, ArrowLeft, Mail, CalendarDays, X } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Mono from '../ui/Mono.jsx'
import GetAKey from './GetAKey.jsx'
import UnverifiedAppNote from './UnverifiedAppNote.jsx'
import { useAuth } from '../../lib/AuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import useKeyStatus from '../../lib/useKeyStatus.js'
import { TRACKS, profileTracks } from '../../lib/tracks.js'
import { connectGmail, listGmailConnections, connectGoogleCalendar, getGoogleCalendarStatus } from '../../lib/googleAuth.js'
import { fetchSchools, getUserSetting, setUserSetting, fetchTargetCompanies, saveTargetCompanies, addContact } from '../../db.js'
import { resumeStep, STEP_IDS, STEP_SETTING_KEY } from '../../lib/onboarding.js'

// First-run setup (v1.2 spec 02). AuthGate renders this instead of the app while
// profiles.onboarded_at is null. Only "About you" is required; every later step can be
// skipped. The current step is saved to user_settings before any OAuth redirect, so coming
// back from Google (the callbacks always redirect to "/") lands on the same step.
const STEPS = [
  { id: 'about',    title: 'About you',   blurb: 'So everything is tuned to what you\'re recruiting for.' },
  { id: 'key',      title: 'AI key',      blurb: 'Powers extraction, drafting, and ranking. Bring your own key.' },
  { id: 'gmail',    title: 'Gmail',       blurb: 'The magic part: applications and contacts fill in from your inbox.' },
  { id: 'calendar', title: 'Calendar',    blurb: 'Interviews, OAs, and recruiting events on your calendar.' },
  { id: 'seed',     title: 'Targets',     blurb: 'A few companies and people to start from.' },
  { id: 'done',     title: 'Ready',       blurb: '' },
]

const TARGET_HINTS = {
  swe: 'Stripe, Datadog, Ramp', pm: 'Notion, Figma, Duolingo', ib: 'Goldman Sachs, Evercore, Lazard',
  quant: 'Jane Street, Citadel, Optiver', consulting: 'McKinsey, Bain, BCG',
}

export default function OnboardingWizard() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const [stepId, setStepId] = useState(null)

  useEffect(() => {
    getUserSetting(STEP_SETTING_KEY).then(saved => setStepId(resumeStep(saved))).catch(() => setStepId('about'))
  }, [])

  async function go(id) {
    setStepId(id)
    try { await setUserSetting(STEP_SETTING_KEY, id) } catch { /* resume is best-effort */ }
  }
  const idx = STEP_IDS.indexOf(stepId)
  const next = () => go(STEP_IDS[Math.min(idx + 1, STEP_IDS.length - 1)])
  const back = () => go(STEP_IDS[Math.max(idx - 1, 0)])

  async function finish() {
    await supabase.from('profiles').update({ onboarded_at: new Date().toISOString() }).eq('id', user.id)
    try { await setUserSetting(STEP_SETTING_KEY, null) } catch { /* ignore */ }
    await refreshProfile()
  }

  if (!stepId) return <div className="min-h-screen bg-canvas" />
  const step = STEPS[idx]

  return (
    <div className="min-h-screen bg-canvas md:flex">
      {/* Step rail — desktop */}
      <aside className="hidden md:flex md:w-64 shrink-0 bg-ink-900 text-ink-100 flex-col p-6">
        <p className="font-heading text-lg font-semibold text-white">Recruiting OS</p>
        <Mono className="text-ink-400 mt-1">SETUP · {String(idx + 1).padStart(2, '0')}/{String(STEPS.length).padStart(2, '0')}</Mono>
        <ol className="mt-8 space-y-1">
          {STEPS.map((s, i) => (
            <li key={s.id} className={`flex items-center gap-3 px-2 py-2 text-sm border-l-2 ${
              i === idx ? 'border-accent-500 text-white bg-ink-800' : i < idx ? 'border-ink-600 text-ink-300' : 'border-transparent text-ink-500'}`}>
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
          <Mono className="text-accent-600 learn-rise">STEP {String(idx + 1).padStart(2, '0')}</Mono>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-ink-900 mt-1 learn-rise" style={{ animationDelay: '40ms' }}>
            {step.id === 'done' ? 'You\'re set up.' : step.title}
          </h1>
          {step.blurb && <p className="text-sm text-ink-500 mt-1 learn-rise" style={{ animationDelay: '80ms' }}>{step.blurb}</p>}
          <div className="mt-6 learn-rise" style={{ animationDelay: '140ms' }}>
            {step.id === 'about'    && <AboutStep user={user} profile={profile} refreshProfile={refreshProfile} onNext={next} />}
            {step.id === 'key'      && <KeyStep user={user} onNext={next} onBack={back} />}
            {step.id === 'gmail'    && <GmailStep onNext={next} onBack={back} />}
            {step.id === 'calendar' && <CalendarStep onNext={next} onBack={back} />}
            {step.id === 'seed'     && <SeedStep profile={profile} onNext={next} onBack={back} />}
            {step.id === 'done'     && <DoneStep user={user} onFinish={finish} onBack={back} />}
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
                className={`flex items-center justify-between text-left px-4 py-3 border-r border-b border-ink-300 transition-colors ${on ? 'bg-ink-900 text-white' : 'bg-white hover:bg-ink-50 text-ink-800'}`}>
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
        <Input className="bg-white" label="Name" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        <Input className="bg-white" label="Grad year" type="number" placeholder="2028" value={form.grad_year} onChange={e => setForm(f => ({ ...f, grad_year: e.target.value }))} />
        <div className="sm:col-span-2">
          <Input className="bg-white" label="School" list="onboarding-schools" value={form.school} placeholder="University of …"
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

function KeyStep({ user, onNext, onBack }) {
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
      <Nav onBack={onBack} onNext={onNext} skip={status.ai ? null : onNext} nextDisabled={!status.ai} />
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

function GmailStep({ onNext, onBack }) {
  const [conns, setConns] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { listGmailConnections().then(setConns).catch(() => setConns([])) }, [])
  const connected = (conns || []).length > 0
  return (
    <div className="space-y-4">
      {connected
        ? conns.map(c => <ConnectedRow key={c.email} icon={Mail} label={c.email} />)
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
      <Nav onBack={onBack} onNext={onNext} skip={connected ? null : onNext} nextDisabled={!connected} />
    </div>
  )
}

function CalendarStep({ onNext, onBack }) {
  const [status, setStatus] = useState(null)
  const [err, setErr] = useState(null)
  useEffect(() => { getGoogleCalendarStatus('personal').then(setStatus).catch(() => setStatus({ connected: false })) }, [])
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
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onBack={onBack} onNext={onNext} skip={status?.connected ? null : onNext} nextDisabled={!status?.connected} />
    </div>
  )
}

function SeedStep({ profile, onNext, onBack }) {
  const [targets, setTargets] = useState([])
  const [draft, setDraft] = useState('')
  const [people, setPeople] = useState([{ name: '', company: '' }])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  useEffect(() => { fetchTargetCompanies().then(setTargets).catch(() => setTargets([])) }, [])
  const hint = profileTracks(profile).map(t => TARGET_HINTS[t]).filter(Boolean)[0]

  function addTargets(text) {
    const names = text.split(',').map(s => s.trim()).filter(Boolean)
    setTargets(t => [...t, ...names.filter(n => !t.some(x => x.toLowerCase() === n.toLowerCase()))])
    setDraft('')
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

  const anything = targets.length || draft.trim() || people.some(p => p.name.trim())
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 mb-2">Target companies</p>
        <div className="flex gap-2">
          <Input className="bg-white" value={draft} onChange={e => setDraft(e.target.value)} placeholder={hint ? `e.g. ${hint}` : 'Company names, comma-separated'}
            onKeyDown={e => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); addTargets(draft) } }} />
          <Button variant="secondary" size="sm" onClick={() => addTargets(draft)} disabled={!draft.trim()}>Add</Button>
        </div>
        {targets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {targets.map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-ink-900 text-white rounded-sm">
                {t}
                <button onClick={() => setTargets(ts => ts.filter(x => x !== t))} aria-label={`Remove ${t}`} className="text-ink-300 hover:text-white"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-ink-400 mt-1.5">Grow uses these to show where you have no contacts yet, then finds people to reach out to.</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-500 mb-2">People you already know (optional)</p>
        <div className="space-y-2">
          {people.map((p, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <Input className="bg-white" placeholder="Name" value={p.name} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Input className="bg-white" placeholder="Company" value={p.company} onChange={e => setPeople(ps => ps.map((x, j) => j === i ? { ...x, company: e.target.value } : x))} />
            </div>
          ))}
        </div>
        {people.length < 3 && (
          <button onClick={() => setPeople(ps => [...ps, { name: '', company: '' }])} className="text-xs text-accent-700 hover:underline mt-2">+ another person</button>
        )}
      </div>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <Nav onBack={onBack} onNext={save} nextDisabled={busy || !anything} nextLabel={busy ? 'Saving…' : 'Continue'} skip={onNext} />
    </div>
  )
}

function DoneStep({ user, onFinish, onBack }) {
  const status = useKeyStatus(user?.id)
  const [gmail, setGmail] = useState(null)
  const [cal, setCal] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    listGmailConnections().then(c => setGmail(c.length > 0)).catch(() => setGmail(false))
    getGoogleCalendarStatus('personal').then(s => setCal(!!s.connected)).catch(() => setCal(false))
  }, [])
  const rows = [
    { label: 'AI features', on: status.ai, off: 'Off: add a key in Settings anytime' },
    { label: 'Gmail auto-tracking', on: gmail, off: 'Off: connect in Settings anytime' },
    { label: 'Google Calendar', on: cal, off: 'Off: connect in Settings anytime' },
  ]
  return (
    <div>
      <div className="border-t border-l border-ink-200">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between px-4 py-3 border-r border-b border-ink-200 bg-white text-sm">
            <span className="text-ink-800">{r.label}</span>
            {r.on == null ? <Mono className="text-ink-300">…</Mono>
              : r.on ? <Mono className="text-success-700">ON</Mono>
              : <span className="text-xs text-ink-400">{r.off}</span>}
          </div>
        ))}
      </div>
      {user?.email?.endsWith('@byok.local') && (
        <p className="text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-md p-3 mt-4">
          You signed in with an API key, so that key is currently your only way back in. Settings → "Secure your account"
          lets you link Google or set a password.
        </p>
      )}
      <Nav onBack={onBack} onNext={async () => { setBusy(true); await onFinish() }} nextDisabled={busy} nextLabel="Go to Today" />
    </div>
  )
}
