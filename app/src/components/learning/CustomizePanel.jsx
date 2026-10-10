import { useState, useEffect, useRef } from 'react'
import { Reorder, useDragControls } from 'motion/react'
import { GripVertical, Eye, EyeOff, Trash2, ChevronDown, Sparkles, RefreshCw, Plus, X } from 'lucide-react'
import SidePanel from '../ui/SidePanel.jsx'
import Tabs from '../ui/Tabs.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Mono from '../ui/Mono.jsx'
import { WIDGET_TYPES, GOAL_METRICS } from '../../lib/learning/templates.js'
import { suggestTopics } from '../../lib/learning/coach.js'
import { goalLabel } from './widgets.jsx'
import { planUsernameCommit } from '../../lib/learning/leetcodeImport.js'
import NeedsKey from '../onboarding/NeedsKey.jsx'

const SECTIONS = [
  { key: 'topics', label: 'Topics' },
  { key: 'stats', label: 'Stats' },
  { key: 'goals', label: 'Goals' },
  { key: 'track', label: 'Track' },
]

// The Learn tab's customization editor: what to track (topics), which stats to show and in
// what order (widgets), and goals. Every change saves immediately — there is no "Save" step
// to forget; drag-reorders persist on drop.
export default function CustomizePanel({ view, learning, onClose, initialSection = 'topics' }) {
  const [section, setSection] = useState(initialSection)
  return (
    <SidePanel onClose={onClose} className="md:w-[560px]">
      <div className="sticky top-0 bg-white z-10 border-b border-ink-200 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Customize</p>
            <h2 className="text-lg font-semibold text-ink-900">{view.track.name}</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700"><X size={18} /></button>
        </div>
        <Tabs options={SECTIONS} value={section} onChange={setSection} />
      </div>
      <div className="p-5">
        {section === 'topics' && <TopicsEditor view={view} learning={learning} />}
        {section === 'stats' && <WidgetsEditor view={view} learning={learning} />}
        {section === 'goals' && <GoalsEditor view={view} learning={learning} />}
        {section === 'track' && <TrackEditor view={view} learning={learning} onArchived={onClose} />}
      </div>
    </SidePanel>
  )
}

// ── Topics ──

function TopicsEditor({ view, learning }) {
  const [order, setOrder] = useState(view.topics.map(t => t.id))
  const orderRef = useRef(order)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [suggested, setSuggested] = useState(null)
  const [picked, setPicked] = useState(new Set())
  const [describe, setDescribe] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const categories = [...new Set(view.topics.map(t => t.category))]

  // Keep local order in sync when topics are added/removed elsewhere.
  useEffect(() => {
    const ids = view.topics.map(t => t.id)
    setOrder(prev => {
      const kept = prev.filter(id => ids.includes(id))
      const next = [...kept, ...ids.filter(id => !kept.includes(id))]
      orderRef.current = next
      return next
    })
  }, [view.topics])

  function onReorder(next) { orderRef.current = next; setOrder(next) }
  function persistOrder() { learning.reorderTopics(orderRef.current).catch(e => setErr(e.message)) }

  async function add() {
    if (!newName.trim()) return
    await learning.addTopics(view.track.id, [{ name: newName.trim(), category: newCategory.trim() || 'General', targetLevel: 3, weight: 1, lcTags: [] }])
    setNewName('')
  }

  async function suggest() {
    setBusy(true); setErr(null)
    try {
      const rows = await suggestTopics({ trackName: view.track.name, description: describe, existing: view.topics.map(t => t.name) })
      setSuggested(rows); setPicked(new Set(rows.map((_, i) => i)))
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  async function addSuggested() {
    const rows = suggested.filter((_, i) => picked.has(i))
    if (rows.length) await learning.addTopics(view.track.id, rows)
    setSuggested(null)
  }

  const byId = new Map(view.topics.map(t => [t.id, t]))
  return (
    <div className="space-y-5">
      <p className="text-xs text-ink-500">Drag to reorder. Set a <b>target</b> level for where you need to be, and optionally rate yourself (<b>self</b>) — practice evidence takes over as you log.</p>

      <Reorder.Group axis="y" values={order} onReorder={onReorder} className="border border-ink-200 divide-y divide-ink-100">
        {order.map(id => byId.get(id) && (
          <TopicRow key={id} topic={byId.get(id)} mastery={view.mastery.get(id)} categories={categories} learning={learning} onDrop={persistOrder} />
        ))}
      </Reorder.Group>

      <div className="border border-dashed border-ink-300 p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Add a topic</p>
        <div className="flex gap-2">
          <Input placeholder="e.g. Tries, Case interviews, Options pricing" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <Input placeholder="Category" list="learn-categories" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="max-w-[40%]" />
          <datalist id="learn-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
          <Button size="sm" variant="secondary" onClick={add}><Plus size={13} /></Button>
        </div>
      </div>

      <div className="border border-ink-200 p-3 space-y-2 bg-ink-50">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">Suggest topics with AI</p>
        {!suggested && (
          <>
            <Input placeholder="Optional: what you're prepping for (e.g. 'consulting case interviews at MBB')" value={describe} onChange={e => setDescribe(e.target.value)} />
            <NeedsKey kind="ai"><Button size="sm" onClick={suggest} disabled={busy}><Sparkles size={13} className="inline -mt-0.5 mr-1" />{busy ? 'Thinking…' : 'Suggest missing topics'}</Button></NeedsKey>
          </>
        )}
        {suggested && (
          <>
            {!suggested.length && <p className="text-sm text-ink-500">Nothing new to suggest — your list already covers it.</p>}
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {suggested.map((t, i) => (
                <li key={i}>
                  <label className="flex gap-2 items-start text-sm cursor-pointer">
                    <input type="checkbox" className="mt-1 accent-accent-600" checked={picked.has(i)}
                      onChange={() => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })} />
                    <span>
                      <span className="font-medium text-ink-900">{t.name}</span> <span className="text-ink-400 text-xs">· {t.category}</span>
                      {t.rubric.length > 0 && <span className="block text-[11px] text-ink-400">{t.rubric.join(' · ')}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" onClick={addSuggested} disabled={!picked.size}>Add {picked.size}</Button>
              <Button size="sm" variant="ghost" onClick={() => setSuggested(null)}>Discard</Button>
            </div>
          </>
        )}
      </div>
      {err && <p className="text-xs text-danger-600">{err}</p>}
    </div>
  )
}

function Scale({ value, onChange, label, allowClear }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wider text-ink-400 w-12 text-right pr-1">{label}</span>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(allowClear && value === n ? null : n)}
          className={`w-5 h-5 text-[10px] font-mono border ${value === n ? 'bg-ink-900 text-white border-ink-900' : value && n < value ? 'bg-ink-200 border-ink-200 text-ink-600' : 'bg-white border-ink-200 text-ink-400'}`}>{n}</button>
      ))}
    </div>
  )
}

function TopicRow({ topic, mastery, categories, learning, onDrop }) {
  const controls = useDragControls()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(topic.name)
  const [tags, setTags] = useState((topic.lcTags || []).join(', '))
  const save = fields => learning.updateTopic(topic.id, fields)

  return (
    <Reorder.Item value={topic.id} dragListener={false} dragControls={controls} onDragEnd={onDrop}
      className={`bg-white ${topic.hidden ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 px-2 py-2">
        <button onPointerDown={e => controls.start(e)} className="text-ink-300 hover:text-ink-600 cursor-grab active:cursor-grabbing touch-none" aria-label="Drag to reorder">
          <GripVertical size={14} />
        </button>
        <div className="flex-1 min-w-0">
          <input value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name !== topic.name && save({ name: name.trim() })}
            className="w-full text-sm font-medium text-ink-900 bg-transparent border-b border-transparent hover:border-ink-200 focus:border-accent-400 focus:outline-none" />
          <p className="text-[11px] text-ink-400">{topic.category}{mastery ? ` · now ${mastery.level.toFixed(1)}${mastery.verified ? '' : ' (unverified)'}` : ''}</p>
        </div>
        <Scale label="target" value={topic.targetLevel} onChange={v => save({ targetLevel: v })} />
        <button onClick={() => save({ hidden: !topic.hidden })} className="text-ink-400 hover:text-ink-700" title={topic.hidden ? 'Show' : 'Hide'}>
          {topic.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <button onClick={() => setOpen(o => !o)} className="text-ink-400 hover:text-ink-700"><ChevronDown size={14} className={open ? 'rotate-180' : ''} /></button>
      </div>
      {open && (
        <div className="px-8 pb-3 space-y-2">
          <Scale label="self" value={topic.selfRating} onChange={v => save({ selfRating: v })} allowClear />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">Category</label>
              <select value={topic.category} onChange={e => save({ category: e.target.value })} className="w-full px-2 py-1 border border-ink-200 text-xs bg-white">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">Interview weight</label>
              <select value={topic.weight} onChange={e => save({ weight: Number(e.target.value) })} className="w-full px-2 py-1 border border-ink-200 text-xs bg-white">
                {[0.5, 0.75, 1, 1.25, 1.5].map(w => <option key={w} value={w}>{w === 1 ? '1 (normal)' : w < 1 ? `${w} (rare)` : `${w} (common)`}</option>)}
                {![0.5, 0.75, 1, 1.25, 1.5].includes(topic.weight) && <option value={topic.weight}>{topic.weight}</option>}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">LeetCode tags that count here</label>
            <input value={tags} onChange={e => setTags(e.target.value)}
              onBlur={() => save({ lcTags: tags.split(',').map(s => s.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean) })}
              placeholder="e.g. tree, binary-tree" className="w-full px-2 py-1 border border-ink-200 text-xs font-mono" />
          </div>
          <button onClick={() => confirm(`Delete "${topic.name}"? Logged practice stays, it just won't count toward this topic.`) && learning.deleteTopic(topic.id)}
            className="text-xs text-danger-600 hover:underline inline-flex items-center gap-1"><Trash2 size={12} /> Delete topic</button>
        </div>
      )}
    </Reorder.Item>
  )
}

// ── Stats (widgets) ──

function WidgetsEditor({ view, learning }) {
  const config = view.track.config || {}
  const widgets = mergeWidgets(config.widgets, { lcTrack: view.visible.some(t => t.lcTags?.length) })
  const [order, setOrder] = useState(widgets.map(w => w.type))
  const orderRef = useRef(order)
  const visible = new Map(widgets.map(w => [w.type, w.visible]))

  function save(nextOrder, nextVisible) {
    const next = nextOrder.map(type => ({ type, visible: nextVisible.get(type) }))
    learning.saveTrack(view.track.id, { config: { ...config, widgets: next } })
  }
  function toggle(type) {
    const v = new Map(visible); v.set(type, !v.get(type))
    save(orderRef.current, v)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">Choose which panels appear on this track's dashboard and drag them into the order you want.</p>
      <Reorder.Group axis="y" values={order} onReorder={next => { orderRef.current = next; setOrder(next) }} className="border border-ink-200 divide-y divide-ink-100">
        {order.map(type => {
          const meta = WIDGET_TYPES.find(w => w.type === type)
          return (
            <WidgetRow key={type} type={type} meta={meta} on={visible.get(type)} onToggle={() => toggle(type)} onDrop={() => save(orderRef.current, visible)} />
          )
        })}
      </Reorder.Group>
    </div>
  )
}

function WidgetRow({ type, meta, on, onToggle, onDrop }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={type} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="bg-white flex items-center gap-3 px-2 py-2.5">
      <button onPointerDown={e => controls.start(e)} className="text-ink-300 hover:text-ink-600 cursor-grab touch-none" aria-label="Drag to reorder"><GripVertical size={14} /></button>
      <div className="flex-1">
        <p className={`text-sm font-medium ${on ? 'text-ink-900' : 'text-ink-400'}`}>{meta?.label || type}</p>
        <p className="text-[11px] text-ink-400">{meta?.desc}</p>
      </div>
      <button role="switch" aria-checked={on} onClick={onToggle}
        className={`w-9 h-5 border transition-colors relative ${on ? 'bg-accent-600 border-accent-600' : 'bg-ink-100 border-ink-200'}`}>
        <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </Reorder.Item>
  )
}

// Stored widget list + any catalog types added since the track was created (appended, hidden).
// Stored widget list + any widget types added since it was saved. New `lcOnly` types land
// visible on LeetCode tracks, right after their `after` widget; everything else arrives
// hidden at the end.
export function mergeWidgets(stored = [], { lcTrack = false } = {}) {
  const known = new Set(WIDGET_TYPES.map(w => w.type))
  const list = stored.filter(w => known.has(w.type))
  for (const w of WIDGET_TYPES) {
    if (list.some(x => x.type === w.type)) continue
    if (w.lcOnly && lcTrack && stored.length) {
      const at = list.findIndex(x => x.type === w.after)
      list.splice(at < 0 ? list.length : at + 1, 0, { type: w.type, visible: true })
    } else list.push({ type: w.type, visible: false })
  }
  return list
}

// ── Goals ──

function GoalsEditor({ view, learning }) {
  const config = view.track.config || {}
  const goals = config.goals || []
  const categories = [...new Set(view.visible.map(t => t.category))]
  const [draft, setDraft] = useState({ metric: 'problems', period: 'week', target: 5, category: '', difficulty: '', deadline: '', level: '' })
  const metric = GOAL_METRICS.find(m => m.key === draft.metric)

  function saveGoals(next) { learning.saveTrack(view.track.id, { config: { ...config, goals: next } }) }
  function add() {
    const g = {
      id: `g-${Date.now().toString(36)}`, metric: draft.metric,
      period: draft.period === 'deadline' ? 'total' : draft.period,
      target: Math.max(1, Number(draft.target) || 1),
      since: new Date().toISOString(),
    }
    if (draft.category) g.category = draft.category
    if (draft.difficulty && metric?.supportsDifficulty) g.difficulty = draft.difficulty
    if (draft.period === 'deadline' && draft.deadline) g.deadline = draft.deadline
    if (draft.metric === 'topics_at_target' && draft.level) g.level = Number(draft.level)
    saveGoals([...goals, g])
  }

  const progressFor = id => view.goals.find(g => g.goal.id === id)?.progress
  return (
    <div className="space-y-5">
      <ul className="border border-ink-200 divide-y divide-ink-100">
        {!goals.length && <li className="px-3 py-3 text-sm text-ink-400">No goals yet.</li>}
        {goals.map(g => {
          const p = progressFor(g.id)
          return (
            <li key={g.id} className="px-3 py-2.5 flex items-center gap-3">
              <span className="flex-1 text-sm text-ink-800">{goalLabel(g, view.topics)}</span>
              {p && <Mono className="text-ink-500">{p.current}/{p.target}</Mono>}
              <input type="number" min="1" defaultValue={g.target} className="w-16 px-1.5 py-0.5 border border-ink-200 text-xs font-mono"
                onBlur={e => { const t = Math.max(1, Number(e.target.value) || 1); if (t !== g.target) saveGoals(goals.map(x => (x.id === g.id ? { ...x, target: t } : x))) }} />
              <button onClick={() => saveGoals(goals.filter(x => x.id !== g.id))} className="text-ink-300 hover:text-danger-600"><Trash2 size={13} /></button>
            </li>
          )
        })}
      </ul>

      <div className="border border-dashed border-ink-300 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">New goal</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Measure">
            <select value={draft.metric} onChange={e => setDraft(d => ({ ...d, metric: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm bg-white">
              {GOAL_METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Target">
            <input type="number" min="1" value={draft.target} onChange={e => setDraft(d => ({ ...d, target: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm font-mono" />
          </Field>
          <Field label="Window">
            <select value={draft.period} onChange={e => setDraft(d => ({ ...d, period: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm bg-white">
              <option value="week">Every week</option>
              <option value="deadline">By a date</option>
              <option value="total">All-time total</option>
            </select>
          </Field>
          {draft.period === 'deadline' ? (
            <Field label="Deadline">
              <input type="date" value={draft.deadline} onChange={e => setDraft(d => ({ ...d, deadline: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm" />
            </Field>
          ) : <div />}
          <Field label="Only count (optional)">
            <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm bg-white">
              <option value="">All topics</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {metric?.supportsDifficulty && (
            <Field label="Difficulty">
              <select value={draft.difficulty} onChange={e => setDraft(d => ({ ...d, difficulty: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm bg-white">
                <option value="">Any</option><option>Easy</option><option>Medium</option><option>Hard</option>
              </select>
            </Field>
          )}
          {draft.metric === 'topics_at_target' && (
            <Field label="At level (default: each topic's target)">
              <select value={draft.level} onChange={e => setDraft(d => ({ ...d, level: e.target.value }))} className="w-full px-2 py-1.5 border border-ink-200 text-sm bg-white">
                <option value="">Topic target</option>{[2, 3, 4, 5].map(n => <option key={n} value={n}>≥ {n}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Button size="sm" onClick={add} disabled={draft.period === 'deadline' && !draft.deadline}>Add goal</Button>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return <div><label className="block text-[10px] uppercase tracking-wider text-ink-400 mb-0.5">{label}</label>{children}</div>
}

// ── Track settings ──

// One-off import of every problem ever solved/attempted. The public profile only shows the
// last 20 submissions, so this needs the user's LEETCODE_SESSION cookie — sent through the
// proxy for these requests and never saved (the field clears when the import finishes).
function HistoryImport({ view, learning, snap }) {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState('')
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true); setResult(null); setProgress(null)
    try {
      const res = await learning.importHistory(view.track, session.trim(), setProgress)
      setResult({ ok: `Imported ${res.imported} problem${res.imported === 1 ? '' : 's'} (${res.solved} solved, ${res.attempted} attempted${res.skipped ? `, ${res.skipped} already logged` : ''}).` })
      setOpen(false)
    } catch (e) { setResult({ err: e.message }) }
    finally { setSession(''); setBusy(false) }
  }

  return (
    <div className="border-t border-ink-100 pt-2 mt-1 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-600">
          <b>Older solves</b>{snap?.historyImportedAt
            ? <span className="text-ink-400 font-mono"> · imported {new Date(snap.historyImportedAt).toLocaleDateString()}{snap.historySolved != null ? ` · ${snap.historySolved} solved` : ''}</span>
            : <span className="text-ink-400">: the public profile only shows your last 20 submissions.</span>}
        </p>
        {!open && <button onClick={() => setOpen(true)} className="text-xs font-medium text-accent-700 hover:underline whitespace-nowrap">{snap?.historyImportedAt ? 'Re-import' : 'Import full history'}</button>}
      </div>
      {open && (
        <div className="space-y-2">
          <ol className="text-[11px] text-ink-500 list-decimal pl-4 space-y-0.5">
            <li>Open leetcode.com while signed in.</li>
            <li>DevTools → Application → Cookies → https://leetcode.com.</li>
            <li>Copy the value of <Mono>LEETCODE_SESSION</Mono> and paste it here.</li>
          </ol>
          <div className="flex gap-2">
            <input type="password" autoComplete="off" spellCheck={false} value={session} onChange={e => setSession(e.target.value)} placeholder="LEETCODE_SESSION value"
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-ink-200 text-sm font-mono focus:outline-none focus:border-accent-500" />
            <Button size="sm" onClick={run} disabled={busy || session.trim().length < 20}>{busy ? 'Importing…' : 'Import'}</Button>
            <Button size="sm" variant="secondary" onClick={() => { setOpen(false); setSession('') }} disabled={busy}>Cancel</Button>
          </div>
          {progress && busy && <p className="text-[11px] text-ink-400 font-mono">{progress.loaded} / {progress.total || '?'} problems read</p>}
          <p className="text-[11px] text-ink-400">Used once, only to read your solved/attempted list. It isn't saved anywhere, and it's a login cookie, so don't share it elsewhere. Each problem is logged at its last submission date. Problems you already have logged are skipped.</p>
        </div>
      )}
      {result?.ok && <p className="text-xs text-success-700">{result.ok}</p>}
      {result?.err && <p className="text-xs text-danger-600">{result.err}</p>}
    </div>
  )
}

function TrackEditor({ view, learning, onArchived }) {
  const config = view.track.config || {}
  const [name, setName] = useState(view.track.name)
  const [username, setUsername] = useState(config.leetcodeUsername || '')
  const [status, setStatus] = useState(null)
  const syncing = learning.syncing === view.track.id
  const snap = learning.snapshot && learning.snapshot.username?.toLowerCase() === (config.leetcodeUsername || '').toLowerCase() ? learning.snapshot : null

  const syncedMsg = res => `Imported ${res.imported} new solve${res.imported === 1 ? '' : 's'} · ${res.snapshot.difficulty.All ?? 0} lifetime`

  // The username used to save on blur only — Escape, ✕ and Enter don't blur, so it was
  // silently dropped and the daily sync never ran. Commit on every exit path instead;
  // refs keep the unmount commit pointed at the latest input and saved value.
  const draftRef = useRef(username)
  const savedRef = useRef(config.leetcodeUsername || '')
  const learningRef = useRef(learning)
  const pendingRef = useRef(null) // save+sync started by a blur that Sync now's click should reuse
  draftRef.current = username
  learningRef.current = learning
  useEffect(() => { savedRef.current = config.leetcodeUsername || '' }, [config.leetcodeUsername])

  // → the sync result when a new username was saved (it syncs straight away), else null.
  async function commitUsername() {
    const plan = planUsernameCommit(draftRef.current, savedRef.current)
    if (plan.action === 'invalid') { setStatus({ err: 'That doesn\'t look like a LeetCode username (or profile link).' }); return null }
    if (plan.action === 'none') return null
    savedRef.current = plan.username // claim it so a blur racing a click doesn't save twice
    setUsername(plan.username)
    const p = learningRef.current.setLeetcodeUsername(view.track.id, plan.username)
    pendingRef.current = p
    p.finally(() => { if (pendingRef.current === p) pendingRef.current = null }).catch(() => {})
    return p
  }

  async function commitAndReport() {
    setStatus(null)
    try {
      const res = await commitUsername()
      if (res) setStatus({ ok: syncedMsg(res) })
    } catch (e) { setStatus({ err: e.message }) }
  }

  // Closing the panel unmounts this without a blur. Fire-and-forget: the hook lives in
  // AppInner, so the save + first sync finish after the panel is gone.
  useEffect(() => () => {
    const plan = planUsernameCommit(draftRef.current, savedRef.current)
    if (plan.action === 'save') learningRef.current.setLeetcodeUsername(view.track.id, plan.username).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sync() {
    setStatus(null)
    try {
      const res = (await commitUsername()) ?? (pendingRef.current ? await pendingRef.current : null) ?? (savedRef.current
        ? await learning.runLeetcodeSync({ ...view.track, config: { ...config, leetcodeUsername: savedRef.current } })
        : null)
      if (res) setStatus({ ok: syncedMsg(res) })
    } catch (e) { setStatus({ err: e.message }) }
  }

  return (
    <div className="space-y-5">
      <Input label="Track name" value={name} onChange={e => setName(e.target.value)} onBlur={() => name.trim() && name !== view.track.name && learning.saveTrack(view.track.id, { name: name.trim() })} />

      <div className="border border-ink-200 p-3 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">LeetCode import</p>
        <p className="text-xs text-ink-500">Reads your <b>public</b> LeetCode profile every few hours while the app is open: solved counts per tag and per language (these seed your DSA levels), plus your 20 most recent submissions. LeetCode only ever shows those 20, so each one is saved here the first time it's seen and kept. Failed tries count as struggles. Nothing is posted to LeetCode.</p>
        <div className="flex gap-2">
          <Input placeholder="LeetCode username or profile link" value={username} onChange={e => setUsername(e.target.value)} onBlur={commitAndReport}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitAndReport() } }} className="font-mono" />
          <Button size="sm" variant="secondary" onClick={sync} disabled={!username.trim() || syncing}>
            <RefreshCw size={13} className={`inline -mt-0.5 mr-1 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Syncing' : 'Sync now'}
          </Button>
        </div>
        {snap && <p className="text-[11px] text-ink-400 font-mono">last sync {new Date(snap.syncedAt).toLocaleString()} · {snap.difficulty?.All ?? 0} solved lifetime</p>}
        {status?.ok && <p className="text-xs text-success-700">{status.ok}</p>}
        {status?.err && <p className="text-xs text-danger-600">{status.err}</p>}
        {config.leetcodeUsername && <HistoryImport view={view} learning={learning} snap={snap} />}
        <p className="text-[11px] text-ink-400">CodeSignal, HackerRank and other OAs have no public API. Log them with <b>+ Log → OA</b>, or from an application when you mark its OA done.</p>
      </div>

      <button onClick={() => confirm(`Archive the "${view.track.name}" track? Its logs are kept.`) && learning.archiveTrack(view.track.id).then(onArchived)}
        className="text-xs text-danger-600 hover:underline">Archive this track</button>
    </div>
  )
}
