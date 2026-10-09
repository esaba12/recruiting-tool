import { useState, useEffect } from 'react'
import { SlidersHorizontal, Plus, MessageSquareText, RefreshCw, Check } from 'lucide-react'
import Button from './ui/Button.jsx'
import Mono from './ui/Mono.jsx'
import EmptyState from './ui/EmptyState.jsx'
import Modal from './ui/Modal.jsx'
import { TEMPLATES, defaultTemplateKeys } from '../lib/learning/templates.js'
import { useTrackView, activeTrack } from '../lib/learning/useLearning.js'
import useCompanyPrep from '../lib/learning/useCompanyPrep.js'
import { lsGet, lsSet } from '../lib/scopedStorage.js'
import { profileTracks } from '../lib/tracks.js'
import {
  SummaryWidget, GoalsWidget, GapsWidget, PlanWidget, MasteryWidget, ReviewWidget, ActivityWidget,
  DifficultyWidget, RecentWidget, CompanyPrepWidget, LanguagesWidget, FULL_WIDTH,
} from './learning/widgets.jsx'
import CustomizePanel, { mergeWidgets } from './learning/CustomizePanel.jsx'
import LogModal from './learning/LogModal.jsx'
import ExplainBackModal from './learning/ExplainBackModal.jsx'

const ACTIVE_TRACK_KEY = 'rec_learn_active_track'

// Learn — interview-prep tracking. One dashboard per track (SWE, IB, PM, custom…), built
// from the widgets the user chose in Customize, over a pure mastery/gap/goal engine
// (lib/learning/mastery.js). Practice happens off-app (LeetCode, CodeSignal, mocks); this
// tab is where it gets logged, measured against targets, and turned into what to do next.
export default function LearnTab({ learning, apps, profile, logRequest, onLogRequestHandled, isDemoMode = false }) {
  const [trackId, setTrackId] = useState(() => lsGet(ACTIVE_TRACK_KEY))
  const [customizing, setCustomizing] = useState(false)
  const [logInitial, setLogInitial] = useState(null)
  const [explainTopic, setExplainTopic] = useState(undefined) // undefined = closed, null = open w/o preset
  const [addingTrack, setAddingTrack] = useState(false)
  const track = activeTrack(learning, trackId)
  // Company problem lists only matter for tracks that practice on LeetCode.
  const lcTrack = !!track && learning.topics.some(t => t.trackId === track.id && t.lcTags?.length)
  const companyPrep = useCompanyPrep(track, apps, { enabled: learning.loaded && lcTrack && !isDemoMode })
  const view = useTrackView(learning, trackId, apps, companyPrep.sets)

  useEffect(() => { if (view?.track && view.track.id !== trackId) setTrackId(view.track.id) }, [view?.track, trackId])
  useEffect(() => { if (trackId) { try { lsSet(ACTIVE_TRACK_KEY, trackId) } catch { /* private mode */ } } }, [trackId])

  // External "log this" requests (Today's OA hook) open the modal pre-filled.
  useEffect(() => {
    if (logRequest && view) { setLogInitial(logRequest); onLogRequestHandled?.() }
  }, [logRequest, view, onLogRequestHandled])

  if (!learning.loaded) return <EmptyState msg="Loading your prep…" />
  if (learning.error) return <EmptyState msg={`Couldn't load Learn: ${learning.error}`} />
  if (!learning.tracks.length) return <Onboarding learning={learning} tracks={profileTracks(profile)} />

  const widgets = mergeWidgets(view.track.config?.widgets, { lcTrack }).filter(w => w.visible)
  const openLog = (initial = {}) => setLogInitial(initial)
  const lcUser = view.track.config?.leetcodeUsername
  const trackSnapshot = lcUser && learning.snapshot?.username?.toLowerCase() === lcUser.toLowerCase() ? learning.snapshot : null

  function renderWidget(type) {
    switch (type) {
      case 'summary': return <SummaryWidget view={view} />
      case 'goals': return <GoalsWidget view={view} onCustomize={() => setCustomizing(true)} />
      case 'gaps': return <GapsWidget view={view} onExplain={t => setExplainTopic(t)} onLog={openLog} />
      case 'plan': return <PlanWidget view={view} onLog={openLog} onExplain={t => setExplainTopic(t)} />
      case 'mastery': return <MasteryWidget view={view} />
      case 'review': return <ReviewWidget view={view} onLog={openLog} onDismiss={id => learning.dismissReview(id)} />
      case 'activity': return <ActivityWidget view={view} />
      case 'difficulty': return <DifficultyWidget view={view} snapshot={view.track.config?.leetcodeUsername ? learning.snapshot : null} />
      case 'languages': return <LanguagesWidget snapshot={trackSnapshot} onCustomize={() => setCustomizing(true)} />
      case 'recent': return <RecentWidget view={view} onDelete={id => learning.removeLog(id)} />
      case 'company': return <CompanyPrepWidget view={view} prep={companyPrep} onLog={openLog} isDemoMode={isDemoMode}
        onPin={names => learning.saveTrack(view.track.id, { config: { ...view.track.config, prepCompanies: names } })} />
      default: return null
    }
  }

  const syncing = learning.syncing === view.track.id
  return (
    <div className="space-y-4">
      {/* Header: track switcher + actions */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 md:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Interview prep</p>
          <div className="flex items-center gap-1 mt-1 overflow-x-auto">
            {learning.tracks.map(t => (
              <button key={t.id} onClick={() => setTrackId(t.id)}
                className={`px-3 py-1.5 text-sm font-semibold border whitespace-nowrap transition-colors ${t.id === view.track.id ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-200 hover:border-ink-400'}`}>
                {t.name}
              </button>
            ))}
            <button onClick={() => setAddingTrack(true)} className="px-2 py-1.5 text-ink-400 hover:text-ink-800 border border-dashed border-ink-300 hover:border-ink-500" title="Add a track">
              <Plus size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {view.track.config?.leetcodeUsername && (
            <button onClick={() => learning.runLeetcodeSync(view.track).catch(() => {})} disabled={syncing}
              className="text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1 font-mono mr-1" title="Sync LeetCode now">
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {view.track.config.leetcodeUsername}
            </button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setExplainTopic(null)} disabled={!view.visible.length}>
            <MessageSquareText size={13} className="inline -mt-0.5 mr-1" />Explain back
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCustomizing(true)}>
            <SlidersHorizontal size={13} className="inline -mt-0.5 mr-1" />Customize
          </Button>
          <Button size="sm" onClick={() => openLog()}>+ Log</Button>
        </div>
      </div>

      {isDemoMode && (
        <p className="text-xs text-ink-500 border border-ink-200 bg-white px-3 py-2">Sample prep data. AI study plans and explain-back grading need a signed-in account with an API key.</p>
      )}

      {!widgets.length && <EmptyState msg="Every panel is hidden — turn some on in Customize → Stats." />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {widgets.map((w, i) => (
          <div key={w.type} className={`${FULL_WIDTH.has(w.type) ? 'lg:col-span-2' : ''} learn-rise`} style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
            {renderWidget(w.type)}
          </div>
        ))}
      </div>

      {customizing && <CustomizePanel view={view} learning={learning} onClose={() => setCustomizing(false)} />}
      {logInitial && <LogModal view={view} apps={apps} initial={logInitial} onSave={learning.logAttempt} onClose={() => setLogInitial(null)} />}
      {explainTopic !== undefined && <ExplainBackModal view={view} topic={explainTopic} onLog={learning.logAttempt} onClose={() => setExplainTopic(undefined)} />}
      {addingTrack && <AddTrackModal learning={learning} onClose={() => setAddingTrack(false)} onCreated={t => { setTrackId(t.id); setAddingTrack(false) }} />}
    </div>
  )
}

// ── First run: pick what you're recruiting for ──
function Onboarding({ learning, tracks }) {
  const [picked, setPicked] = useState(() => new Set(defaultTemplateKeys(tracks)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function start() {
    setBusy(true); setErr(null)
    try { for (const key of picked) await learning.createTrack(key) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400 learn-rise">Interview prep</p>
      <h1 className="text-2xl font-semibold text-ink-900 mt-1 learn-rise" style={{ animationDelay: '60ms' }}>What are you recruiting for?</h1>
      <p className="text-sm text-ink-500 mt-1 mb-5 learn-rise" style={{ animationDelay: '120ms' }}>
        Each track starts from a topic template. You can rename, hide or add topics, choose which stats to show, and set goals. Pick more than one if you're recruiting across tracks.
      </p>
      <TemplateGrid picked={picked} onToggle={k => setPicked(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n })} />
      {err && <p className="text-xs text-danger-600 mt-3">{err}</p>}
      <Button className="mt-5" onClick={start} disabled={!picked.size || busy}>{busy ? 'Setting up…' : `Start ${picked.size} track${picked.size === 1 ? '' : 's'}`}</Button>
    </div>
  )
}

function TemplateGrid({ picked, onToggle }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border-t border-l border-ink-300">
      {Object.entries(TEMPLATES).map(([key, t], i) => {
        const on = picked.has(key)
        const cats = [...new Set(t.topics.map(x => x.category))]
        return (
          <button key={key} onClick={() => onToggle(key)}
            className={`text-left p-4 border-r border-b border-ink-300 transition-colors learn-rise ${on ? 'bg-ink-900 text-white' : 'bg-white hover:bg-ink-50'}`}
            style={{ animationDelay: `${180 + i * 60}ms` }}>
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold">{t.name}</span>
              <span className={`w-4 h-4 border flex items-center justify-center ${on ? 'bg-accent-500 border-accent-500' : 'border-ink-300'}`}>{on && <Check size={11} strokeWidth={3} />}</span>
            </div>
            <p className={`text-xs mt-1 ${on ? 'text-ink-200' : 'text-ink-500'}`}>{t.blurb}</p>
            {t.topics.length > 0 && (
              <Mono className={`block mt-2 text-[11px] ${on ? 'text-accent-300' : 'text-ink-400'}`}>{t.topics.length} topics · {cats.join(' / ')}</Mono>
            )}
          </button>
        )
      })}
    </div>
  )
}

function AddTrackModal({ learning, onClose, onCreated }) {
  const [key, setKey] = useState(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function create() {
    setBusy(true); setErr(null)
    try { onCreated(await learning.createTrack(key, { name: name.trim() || undefined })) } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5 space-y-4">
        <h2 className="text-base font-semibold text-ink-900">Add a track</h2>
        <TemplateGrid picked={new Set(key ? [key] : [])} onToggle={k => { setKey(k); setName(k === 'custom' ? '' : TEMPLATES[k].name) }} />
        {key && (
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Track name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={key === 'custom' ? 'e.g. Consulting' : ''}
              className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            {key === 'custom' && <p className="text-[11px] text-ink-400 mt-1">After creating it, use Customize → Topics → Suggest topics to have AI draft the topic list.</p>}
          </div>
        )}
        {err && <p className="text-xs text-danger-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={create} disabled={!key || busy || (key === 'custom' && !name.trim())}>{busy ? 'Creating…' : 'Create track'}</Button>
        </div>
      </div>
    </Modal>
  )
}
