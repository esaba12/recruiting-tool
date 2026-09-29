import { useState, useMemo } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'
import Tabs from '../ui/Tabs.jsx'
import Mono from '../ui/Mono.jsx'
import { slugFromLeetcodeUrl, PROBLEM_BY_SLUG } from '../../lib/learning/problemBank.js'

const KINDS = [
  { key: 'problem', label: 'Problem' },
  { key: 'session', label: 'Study' },
  { key: 'mock', label: 'Mock' },
  { key: 'assessment', label: 'OA' },
]
const OUTCOMES = [
  { key: 'solved', label: 'Solved', cls: 'bg-success-500 text-white border-success-500' },
  { key: 'hinted', label: 'Needed hints', cls: 'bg-warning-500 text-white border-warning-500' },
  { key: 'failed', label: "Couldn't solve", cls: 'bg-danger-500 text-white border-danger-500' },
]
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PLATFORMS = ['CodeSignal', 'HackerRank', 'Codility', 'LeetCode', 'Other']

// One modal for every kind of practice entry. `initial` pre-fills (e.g. the OA hook passes
// { kind: 'assessment', applicationId, title }; the re-solve queue passes { kind: 'problem', problem: url }).
export default function LogModal({ view, apps = [], initial = {}, onSave, onClose }) {
  const [kind, setKind] = useState(initial.kind || 'problem')
  const [problem, setProblem] = useState(initial.problem || '')
  const [title, setTitle] = useState(initial.title || '')
  const [outcome, setOutcome] = useState(initial.outcome || 'solved')
  const [difficulty, setDifficulty] = useState(initial.difficulty || '')
  const [topicIds, setTopicIds] = useState(initial.topicIds || [])
  const [minutes, setMinutes] = useState(initial.minutes || '')
  const [confidence, setConfidence] = useState(initial.confidence || 3)
  const [score, setScore] = useState(initial.score || '')
  const [platform, setPlatform] = useState(initial.platform || 'CodeSignal')
  const [applicationId, setApplicationId] = useState(initial.applicationId || '')
  const [notes, setNotes] = useState(initial.notes || '')
  const [date, setDate] = useState(localDate())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const slug = kind === 'problem' ? slugFromLeetcodeUrl(problem) : null
  const bank = slug ? PROBLEM_BY_SLUG.get(slug) : null
  // Topics auto-matched from the problem's LeetCode tags — shown so the user sees where it counts.
  const autoTopics = useMemo(() => (bank ? view.visible.filter(t => t.lcTags?.some(tag => bank.tags.includes(tag))) : []), [bank, view.visible])
  const categories = useMemo(() => [...new Set(view.visible.map(t => t.category))], [view.visible])
  const openApps = apps.filter(a => !['Rejected', 'Accepted', 'Wishlist'].includes(a.stage))

  function toggleTopic(id) {
    setTopicIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))
  }

  async function save() {
    setErr(null)
    if (kind === 'problem' && !problem.trim()) { setErr('Paste a LeetCode link or name the problem.'); return }
    if (kind !== 'problem' && !topicIds.length && !title.trim()) { setErr('Pick at least one topic or add a title.'); return }
    setSaving(true)
    try {
      const occurredAt = date === localDate() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString()
      await onSave({
        trackId: view.track.id,
        kind,
        problem: kind === 'problem' ? problem : undefined,
        title: kind === 'assessment' ? (title || `${platform} assessment`) : title || undefined,
        source: kind === 'assessment' ? platform.toLowerCase() : 'manual',
        outcome: ['problem', 'assessment'].includes(kind) ? outcome : null,
        difficulty: kind === 'problem' ? (difficulty || bank?.difficulty || null) : null,
        topicIds,
        minutes: minutes ? Number(minutes) : null,
        confidence,
        score: score !== '' ? Math.max(1, Math.min(5, Number(score))) : null,
        applicationId: applicationId || null,
        notes,
        occurredAt,
      })
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-900">Log practice</h2>
          <Mono className="text-ink-400">{view.track.name}</Mono>
        </div>
        <Tabs options={KINDS} value={kind} onChange={setKind} />

        {kind === 'problem' && (
          <div className="space-y-2">
            <Input label="LeetCode link or problem name" placeholder="https://leetcode.com/problems/two-sum/" value={problem} onChange={e => setProblem(e.target.value)} autoFocus />
            {bank && (
              <p className="text-xs text-ink-500">
                <span className="font-semibold text-ink-700">{bank.title}</span> · {bank.difficulty}
                {autoTopics.length > 0 && <> · counts toward {autoTopics.map(t => t.name).join(', ')}</>}
              </p>
            )}
            {!bank && problem && (
              <div className="flex gap-1.5">
                {['Easy', 'Medium', 'Hard'].map(d => (
                  <button key={d} type="button" onClick={() => setDifficulty(d)}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium border ${difficulty === d ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-200'}`}>{d}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {kind === 'assessment' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => (
                  <button key={p} type="button" onClick={() => setPlatform(p)}
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium border ${platform === p ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-200'}`}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">For application</label>
              <select value={applicationId} onChange={e => setApplicationId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400">
                <option value="">—</option>
                {openApps.map(a => <option key={a.id} value={a.id}>{a.company} — {a.role}</option>)}
              </select>
            </div>
          </div>
        )}

        {kind !== 'problem' && (
          <Input label={kind === 'assessment' ? 'Title (optional)' : 'What did you work on? (optional)'} value={title} onChange={e => setTitle(e.target.value)}
            placeholder={kind === 'mock' ? 'Pramp mock — design a URL shortener' : kind === 'session' ? 'Read DDIA ch. 5 on replication' : ''} />
        )}

        {['problem', 'assessment'].includes(kind) && (
          <div>
            <label className="block text-xs text-ink-400 mb-1">Outcome</label>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOMES.map(o => (
                <button key={o.key} type="button" onClick={() => setOutcome(o.key)}
                  className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${outcome === o.key ? o.cls : 'bg-white text-ink-500 border-ink-200 hover:border-ink-300'}`}>{o.label}</button>
              ))}
            </div>
            {kind === 'problem' && outcome !== 'solved' && <p className="text-[11px] text-ink-400 mt-1">Goes into your re-solve queue — it'll come back when it's due.</p>}
          </div>
        )}

        <div>
          <label className="block text-xs text-ink-400 mb-1">Topics {kind === 'problem' && bank ? '(extra — tags above already count)' : ''}</label>
          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
            {categories.map(cat => (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {view.visible.filter(t => t.category === cat).map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTopic(t.id)}
                      className={`px-2 py-0.5 rounded-sm text-xs border transition-colors ${topicIds.includes(t.id) ? 'bg-accent-600 text-white border-accent-600' : 'bg-white text-ink-500 border-ink-200 hover:border-accent-300'}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Minutes" type="number" min="0" value={minutes} onChange={e => setMinutes(e.target.value)} />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Confidence</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" onClick={() => setConfidence(n)}
                  className={`w-7 h-7 rounded-sm text-xs font-mono border ${confidence === n ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-500 border-ink-200'}`}>{n}</button>
              ))}
            </div>
          </div>
          {['mock', 'assessment'].includes(kind) && (
            <Input label="Score (1–5)" type="number" min="1" max="5" value={score} onChange={e => setScore(e.target.value)} />
          )}
        </div>

        <div>
          <label className="block text-xs text-ink-400 mb-0.5">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="What tripped you up? What would you do differently?"
            className="w-full px-2.5 py-1.5 border border-ink-100 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
        </div>

        {err && <p className="text-xs text-danger-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Log it'}</Button>
        </div>
      </div>
    </Modal>
  )
}
