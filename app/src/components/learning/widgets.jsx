import { useState, useEffect } from 'react'
import { ExternalLink, RotateCcw, X, Sparkles, MessageSquareText, Trash2, AlertTriangle } from 'lucide-react'
import Mono from '../ui/Mono.jsx'
import Button from '../ui/Button.jsx'
import TrendChart from '../charts/TrendChart.jsx'
import DonutChart from '../charts/DonutChart.jsx'
import { DIFFICULTY_COLORS } from '../charts/theme.js'
import { GOAL_METRICS } from '../../lib/learning/templates.js'
import { weeklyActivity, difficultySplit, startOfWeek } from '../../lib/learning/mastery.js'
import { reviewQueue } from '../../lib/learning/review.js'
import { candidateProblems, buildStudyPlan } from '../../lib/learning/coach.js'
import { getUserSetting, setUserSetting } from '../../db.js'
import { AI_PROVIDER_LABEL } from '../../lib/ai.js'

// Industrial "instrument panel" widget shell — hard 1px ink border, mono readouts, a
// squared-off label bar. Every widget renders inside this so the page reads as one panel.
export function Panel({ title, meta, children, className = '', action }) {
  return (
    <section className={`bg-white border border-ink-300 rounded-sm ${className}`}>
      <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-ink-200 bg-ink-50">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-600">{title}</h3>
        <div className="flex items-center gap-2">
          {meta && <Mono className="text-ink-400 text-[11px]">{meta}</Mono>}
          {action}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function goalLabel(goal, topics = []) {
  const m = GOAL_METRICS.find(x => x.key === goal.metric)
  const scope = goal.topicId ? topics.find(t => t.id === goal.topicId)?.name : goal.category
  const diff = goal.difficulty ? `${goal.difficulty} ` : ''
  const label = m ? `${diff}${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}` : goal.metric
  const period = goal.period === 'week' ? '/ week' : goal.deadline ? `by ${new Date(goal.deadline + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'total'
  return `${label}${scope ? ` · ${scope}` : ''} ${period}`
}

// ── Level meter: 5 cells, filled to level, accent tick at target ──
export function LevelMeter({ level, target, verified = true, compact = false }) {
  const cells = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center gap-[3px]" aria-label={`Level ${level} of 5, target ${target}`}>
      {cells.map(c => {
        const fill = Math.max(0, Math.min(1, level - (c - 1)))
        const isTarget = c === target
        return (
          <div key={c} className={`relative ${compact ? 'w-3 h-2.5' : 'w-5 h-3'} bg-ink-100 overflow-hidden ${isTarget ? 'outline outline-2 outline-accent-500 outline-offset-[1px]' : ''}`}>
            <div className={`absolute inset-y-0 left-0 ${verified ? 'bg-ink-800' : 'bg-ink-400 learn-hatch'}`} style={{ width: `${fill * 100}%` }} />
          </div>
        )
      })}
    </div>
  )
}

// ── Summary strip ──
export function SummaryWidget({ view }) {
  const weekStart = startOfWeek()
  const thisWeek = view.logs.filter(l => new Date(l.occurredAt).getTime() >= weekStart)
  const minutes = thisWeek.reduce((s, l) => s + (l.minutes || 0), 0)
  const atTarget = view.visible.filter(t => (view.mastery.get(t.id)?.level ?? 0) >= t.targetLevel).length
  const readiness = view.visible.length ? Math.round((atTarget / view.visible.length) * 100) : 0
  const upcoming = [
    ...view.demand.oas.map(a => ({ label: `${a.company} OA`, date: a.oaDueDate })),
    ...view.demand.interviews.map(a => ({ label: `${a.company} · ${a.stage}`, date: null })),
  ]
  const next = upcoming.find(u => u.date) || upcoming[0]
  const days = next?.date ? Math.ceil((new Date(next.date + 'T23:59:59') - Date.now()) / 86400000) : null
  const tiles = [
    { label: 'This week', value: thisWeek.length, sub: `${minutes} min logged` },
    { label: 'Streak', value: `${view.streak}d`, sub: view.streak ? 'keep it alive today' : 'log anything to start' },
    { label: 'Readiness', value: `${readiness}%`, sub: `${atTarget}/${view.visible.length} topics at target`, bar: readiness },
    { label: 'Next up', value: next ? (days != null ? `${days}d` : 'now') : '—', sub: next ? next.label : 'no interviews in pipeline' },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-ink-300 rounded-sm bg-white divide-x divide-ink-200 [&>*:nth-child(3)]:border-t md:[&>*:nth-child(3)]:border-t-0 [&>*:nth-child(4)]:border-t md:[&>*:nth-child(4)]:border-t-0 [&>*]:border-ink-200">
      {tiles.map((t, i) => (
        <div key={t.label} className="p-4 learn-rise" style={{ animationDelay: `${i * 70}ms` }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">{t.label}</p>
          <Mono className="block text-3xl mt-1 text-ink-900">{t.value}</Mono>
          <p className="text-xs text-ink-400 mt-0.5 truncate">{t.sub}</p>
          {t.bar != null && (
            <div className="h-1 bg-ink-100 mt-2"><div className="h-full bg-accent-600" style={{ width: `${t.bar}%` }} /></div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Goals ──
export function GoalsWidget({ view, onCustomize }) {
  if (!view.goals.length) {
    return (
      <Panel title="Goals">
        <p className="text-sm text-ink-400">No goals yet. <button className="text-accent-700 font-medium hover:underline" onClick={onCustomize}>Set one →</button></p>
      </Panel>
    )
  }
  return (
    <Panel title="Goals" meta={`${view.goals.filter(g => g.progress.done).length}/${view.goals.length} met`}>
      <ul className="space-y-3">
        {view.goals.map(({ goal, progress }) => (
          <li key={goal.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-ink-700">{goalLabel(goal, view.topics)}</span>
              <Mono className={progress.done ? 'text-success-600' : progress.behind ? 'text-danger-600' : 'text-ink-600'}>
                {progress.current}/{progress.target}
              </Mono>
            </div>
            <div className="h-1.5 bg-ink-100 mt-1.5">
              <div className={`h-full transition-all duration-500 ${progress.done ? 'bg-success-500' : progress.behind ? 'bg-danger-500' : 'bg-accent-600'}`}
                style={{ width: `${Math.max(2, progress.pct * 100)}%` }} />
            </div>
            {progress.behind && !progress.done && <p className="text-[11px] text-danger-600 mt-1">Behind pace</p>}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// ── Gaps ──
export function GapsWidget({ view, onExplain, onLog }) {
  if (!view.gaps.length) {
    return <Panel title="Gaps"><p className="text-sm text-ink-400">Every visible topic is at or above target. Raise a target in Customize to keep pushing.</p></Panel>
  }
  const solved = new Set(view.items.map(i => i.externalRef))
  return (
    <Panel title="Gaps" meta="ranked by gap × weight × demand">
      <ol className="divide-y divide-ink-100 -my-2">
        {view.gaps.slice(0, 6).map((g, i) => {
          const isProblemTopic = g.topic.lcTags?.length > 0
          const [pick] = isProblemTopic ? candidateProblems([g], { solvedSlugs: solved, perTopic: 1 }) : []
          return (
            <li key={g.topic.id} className="py-2.5 flex items-start gap-3">
              <Mono className="text-ink-300 w-4 pt-0.5">{String(i + 1).padStart(2, '0')}</Mono>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-900 truncate">{g.topic.name}</p>
                  <LevelMeter level={g.mastery.level} target={g.topic.targetLevel} verified={g.mastery.verified} compact />
                </div>
                <p className="text-xs text-ink-400 mt-0.5">{g.topic.category} · {g.reason}</p>
                <div className="flex gap-3 mt-1">
                  {pick && (
                    <a href={pick.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-accent-700 hover:underline inline-flex items-center gap-1">
                      Try {pick.title} <ExternalLink size={11} />
                    </a>
                  )}
                  {!isProblemTopic && (
                    <button onClick={() => onExplain(g.topic)} className="text-xs font-medium text-accent-700 hover:underline inline-flex items-center gap-1">
                      <MessageSquareText size={12} /> Explain it back
                    </button>
                  )}
                  <button onClick={() => onLog({ kind: isProblemTopic ? 'problem' : 'session', topicIds: [g.topic.id], problem: pick?.url || '' })}
                    className="text-xs text-ink-500 hover:text-ink-800">+ Log</button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

// ── Study plan (AI, cached per week) ──
export function PlanWidget({ view, onLog, onExplain }) {
  const key = `learning_plan:${view.track.id}`
  const [cached, setCached] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const weekStart = new Date(startOfWeek()).toISOString().slice(0, 10)

  useEffect(() => {
    let alive = true
    getUserSetting(key).then(v => { if (alive) setCached(v) }).catch(() => {})
    return () => { alive = false }
  }, [key])

  const stale = cached && cached.weekStart !== weekStart

  async function generate() {
    setBusy(true); setErr(null)
    try {
      const solvedSlugs = new Set(view.items.map(i => i.externalRef))
      const gaps = view.gaps.slice(0, 6)
      const candidates = candidateProblems(gaps, { solvedSlugs })
      const reviewDue = reviewQueue(view.items).length
      const goals = view.goals.map(g => `${goalLabel(g.goal, view.topics)} (${g.progress.current}/${g.progress.target})`)
      const plan = await buildStudyPlan({ trackName: view.track.name, gaps, candidates, demand: view.demand, reviewDue, goals })
      const next = { weekStart, generatedAt: new Date().toISOString(), plan }
      await setUserSetting(key, next)
      setCached(next)
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  const topicName = id => view.topics.find(t => t.id === id)?.name
  return (
    <Panel title="This week's plan" meta={cached ? `${AI_PROVIDER_LABEL} · ${new Date(cached.generatedAt).toLocaleDateString()}` : null}
      action={cached && (
        <button onClick={generate} disabled={busy} className="text-ink-400 hover:text-ink-700 disabled:opacity-40" title="Regenerate">
          <RotateCcw size={13} className={busy ? 'animate-spin' : ''} />
        </button>
      )}>
      {!cached && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <p className="text-sm text-ink-500 flex-1">Turn your gaps, goals and upcoming interviews into 5–8 concrete actions for this week. Problem picks come only from a curated list, and no solutions are included.</p>
          <Button size="sm" onClick={generate} disabled={busy}><Sparkles size={13} className="inline -mt-0.5 mr-1" />{busy ? 'Planning…' : 'Build my plan'}</Button>
        </div>
      )}
      {cached && (
        <>
          {stale && (
            <p className="text-xs text-warning-700 bg-warning-50 border border-warning-200 px-2 py-1 mb-3 flex items-center gap-1.5">
              <AlertTriangle size={12} /> From a previous week — <button className="underline" onClick={generate}>rebuild</button>
            </p>
          )}
          {cached.plan.summary && <p className="text-sm text-ink-700 mb-3">{cached.plan.summary}</p>}
          <ol className="space-y-2">
            {cached.plan.actions.map((a, i) => (
              <li key={i} className="flex gap-3 items-start border-l-2 border-accent-500 pl-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-900">
                    {a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a> : a.title}
                    {a.difficulty && <span className="ml-2 text-[11px] text-ink-400 font-normal">{a.difficulty}</span>}
                  </p>
                  {a.why && <p className="text-xs text-ink-500 mt-0.5">{a.why}</p>}
                </div>
                <Mono className="text-ink-400 shrink-0">{a.minutes}m</Mono>
                {a.kind === 'concept' && a.topicId && topicName(a.topicId) ? (
                  <button onClick={() => onExplain(view.topics.find(t => t.id === a.topicId))} className="text-xs text-accent-700 hover:underline shrink-0">Explain</button>
                ) : (
                  <button onClick={() => onLog({ kind: a.kind === 'mock' ? 'mock' : a.kind === 'problem' ? 'problem' : 'session', problem: a.url || '', topicIds: a.topicId ? [a.topicId] : [] })}
                    className="text-xs text-ink-500 hover:text-ink-800 shrink-0">+ Log</button>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      {err && <p className="text-xs text-danger-600 mt-2">{err}</p>}
    </Panel>
  )
}

// ── Mastery grid ──
export function MasteryWidget({ view }) {
  const cats = [...new Set(view.visible.map(t => t.category))]
  return (
    <Panel title="Mastery" meta="filled = level · outlined = target · hatched = unverified">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {cats.map(cat => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400 mb-1.5 border-b border-ink-100 pb-1">{cat}</p>
            <ul className="space-y-1.5">
              {view.visible.filter(t => t.category === cat).map(t => {
                const m = view.mastery.get(t.id)
                return (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-ink-700 truncate" title={t.name}>{t.name}</span>
                    <LevelMeter level={m.level} target={t.targetLevel} verified={m.verified} />
                    <Mono className="w-14 text-right text-ink-500">{m.level.toFixed(1)}/{t.targetLevel}</Mono>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// ── Re-solve queue ──
export function ReviewWidget({ view, onLog, onDismiss }) {
  const due = reviewQueue(view.items)
  const upcoming = reviewQueue(view.items, { aheadDays: 7 }).filter(i => !due.includes(i))
  return (
    <Panel title="Re-solve queue" meta={`${due.length} due · ${upcoming.length} this week`}>
      {!due.length && !upcoming.length && <p className="text-sm text-ink-400">Nothing queued. Problems you log as "needed hints" or "couldn't solve" come back here on a spaced schedule.</p>}
      <ul className="divide-y divide-ink-100 -my-2">
        {[...due, ...upcoming].slice(0, 8).map(i => {
          const isDue = due.includes(i)
          const days = Math.ceil((new Date(i.dueAt) - Date.now()) / 86400000)
          return (
            <li key={i.id} className="py-2 flex items-center gap-3">
              <span className={`w-1.5 h-1.5 shrink-0 ${isDue ? 'bg-accent-500' : 'bg-ink-200'}`} />
              <div className="flex-1 min-w-0">
                {i.url
                  ? <a href={i.url} target="_blank" rel="noreferrer" className="text-sm text-ink-900 hover:underline truncate block">{i.title}</a>
                  : <p className="text-sm text-ink-900 truncate">{i.title}</p>}
                <p className="text-[11px] text-ink-400">{i.difficulty || '—'} · {isDue ? 'due now' : `in ${days}d`}</p>
              </div>
              {isDue && <button onClick={() => onLog({ kind: 'problem', problem: i.url || i.title })} className="text-xs font-medium text-accent-700 hover:underline">Log result</button>}
              <button onClick={() => onDismiss(i.id)} className="text-ink-300 hover:text-ink-600" title="Drop from queue"><X size={13} /></button>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

// ── Activity ──
export function ActivityWidget({ view }) {
  const data = weeklyActivity(view.logs)
  const total = data.reduce((s, w) => s + w.count, 0)
  return (
    <Panel title="Activity" meta={`${total} entries · 10 wk`}>
      <TrendChart data={data} height={170} />
    </Panel>
  )
}

// ── Difficulty split ──
export function DifficultyWidget({ view, snapshot }) {
  const split = difficultySplit(view.logs)
  const lifetime = snapshot?.difficulty
  const src = lifetime && (lifetime.Easy || lifetime.Medium || lifetime.Hard) ? lifetime : split
  const data = ['Easy', 'Medium', 'Hard'].map(k => ({ label: k, value: src[k] || 0, color: DIFFICULTY_COLORS[k] }))
  return (
    <Panel title="Difficulty" meta={src === lifetime ? 'LeetCode lifetime' : 'logged solves'}>
      {data.every(d => !d.value) ? <p className="text-sm text-ink-400">No solved problems yet.</p> : <DonutChart data={data} height={150} centerLabel="solved" />}
    </Panel>
  )
}

// ── Recent log ──
const KIND_LABEL = { problem: 'Problem', session: 'Study', mock: 'Mock', assessment: 'OA', explain_back: 'Explain-back', reading: 'Reading' }
const OUTCOME_DOT = { solved: 'bg-success-500', hinted: 'bg-warning-500', failed: 'bg-danger-500' }
export function RecentWidget({ view, onDelete }) {
  const rows = view.logs.slice(0, 10)
  const topicName = id => view.topics.find(t => t.id === id)?.name
  return (
    <Panel title="Recent" meta={`${view.logs.length} total`}>
      {!rows.length && <p className="text-sm text-ink-400">Nothing logged yet.</p>}
      <ul className="divide-y divide-ink-100 -my-2">
        {rows.map(l => (
          <li key={l.id} className="py-2 flex items-center gap-3 group">
            <span className={`w-1.5 h-1.5 shrink-0 ${OUTCOME_DOT[l.outcome] || 'bg-ink-300'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-800 truncate">{l.title || l.topicIds.map(topicName).filter(Boolean).join(', ') || KIND_LABEL[l.kind]}</p>
              <p className="text-[11px] text-ink-400">
                {KIND_LABEL[l.kind]}{l.source === 'leetcode' ? ' · imported' : ''}{l.score ? ` · ${l.score}/5` : ''}{l.minutes ? ` · ${l.minutes}m` : ''}
              </p>
            </div>
            <Mono className="text-ink-400 text-[11px]">{new Date(l.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Mono>
            <button onClick={() => onDelete(l.id)} className="text-ink-300 hover:text-danger-600 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Delete entry"><Trash2 size={12} /></button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

// Which widgets span the full row on desktop.
export const FULL_WIDTH = new Set(['summary', 'plan', 'mastery'])
