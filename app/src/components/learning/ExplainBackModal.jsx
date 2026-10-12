import { useState } from 'react'
import { Check, Minus, AlertTriangle, HelpCircle } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Mono from '../ui/Mono.jsx'
import { explainBackQuestion, gradeExplainBack } from '../../lib/learning/coach.js'
import { aiProviderLabel } from '../../lib/ai.js'
import NeedsKey from '../onboarding/NeedsKey.jsx'

// Explain-back: answer an interview-style prompt in your own words, get graded against the
// topic's rubric. The grader names what you covered/missed and asks ONE Socratic question —
// it never writes the answer for you. Each graded attempt is logged (kind 'explain_back',
// score 1–5), which is the main evidence source for concept topics' mastery.
export default function ExplainBackModal({ view, topic: initialTopic, onLog, onClose }) {
  const conceptTopics = view.visible.filter(t => !t.lcTags?.length)
  const [topicId, setTopicId] = useState(initialTopic?.id || conceptTopics[0]?.id || view.visible[0]?.id)
  const topic = view.topics.find(t => t.id === topicId)
  const [answer, setAnswer] = useState('')
  const [grade, setGrade] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [startedAt] = useState(Date.now())
  const question = topic ? explainBackQuestion(topic) : ''

  async function submit() {
    if (answer.trim().length < 40) { setErr('Give it a real attempt — at least a few sentences.'); return }
    setBusy(true); setErr(null)
    try {
      const g = await gradeExplainBack({ topic, question, answer })
      setGrade(g)
      await onLog({
        trackId: view.track.id, kind: 'explain_back', topicIds: [topic.id], title: topic.name,
        score: g.score, confidence: g.score, minutes: Math.max(1, Math.round((Date.now() - startedAt) / 60000)),
        notes: [g.missed.length ? `Missed: ${g.missed.join('; ')}` : '', g.hint ? `Hint: ${g.hint}` : ''].filter(Boolean).join('\n'),
      })
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  function retry() { setGrade(null); setAnswer('') }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink-900">Explain it back</h2>
          <select value={topicId} onChange={e => { setTopicId(e.target.value); setGrade(null) }}
            className="px-2 py-1 border border-ink-200 rounded-sm text-xs bg-white max-w-[55%]">
            {view.visible.map(t => <option key={t.id} value={t.id}>{t.category} — {t.name}</option>)}
          </select>
        </div>

        <div className="border-l-2 border-accent-500 bg-ink-50 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400 mb-1">Interviewer</p>
          <p className="text-sm text-ink-900">{question}</p>
        </div>

        {!grade && (
          <>
            <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={9} autoFocus
              placeholder="Answer like you would out loud — structure first, then detail. No notes."
              className="w-full px-3 py-2 border border-ink-200 rounded-sm text-sm leading-relaxed focus:outline-none focus:border-accent-400" />
            <div className="flex items-center justify-between">
              <Mono className="text-ink-400">{answer.trim().split(/\s+/).filter(Boolean).length} words</Mono>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
                <NeedsKey kind="ai"><Button size="sm" onClick={submit} disabled={busy}>{busy ? `Grading with ${aiProviderLabel()}…` : 'Grade my answer'}</Button></NeedsKey>
              </div>
            </div>
          </>
        )}

        {grade && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => <div key={n} className={`w-6 h-2 ${n <= grade.score ? 'bg-ink-900' : 'bg-ink-100'}`} />)}
              </div>
              <Mono className="text-lg text-ink-900">{grade.score}/5</Mono>
              <span className="text-xs text-ink-400">logged to {topic.name}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success-700 mb-1">Covered</p>
                <ul className="space-y-1">{grade.covered.length ? grade.covered.map((c, i) => <li key={i} className="text-sm text-ink-700 flex gap-1.5"><Check size={14} className="text-success-600 shrink-0 mt-0.5" />{c}</li>) : <li className="text-sm text-ink-400">—</li>}</ul>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-danger-700 mb-1">Missed</p>
                <ul className="space-y-1">{grade.missed.length ? grade.missed.map((c, i) => <li key={i} className="text-sm text-ink-700 flex gap-1.5"><Minus size={14} className="text-danger-500 shrink-0 mt-0.5" />{c}</li>) : <li className="text-sm text-ink-400">Nothing major</li>}</ul>
              </div>
            </div>
            {grade.incorrect.length > 0 && (
              <div className="bg-danger-50 border border-danger-200 px-3 py-2">
                {grade.incorrect.map((c, i) => <p key={i} className="text-sm text-danger-700 flex gap-1.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{c}</p>)}
              </div>
            )}
            {grade.hint && (
              <div className="bg-accent-50 border border-accent-200 px-3 py-2">
                <p className="text-sm text-accent-800 flex gap-1.5"><HelpCircle size={14} className="shrink-0 mt-0.5" />{grade.hint}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
              <Button size="sm" onClick={retry}>Try again</Button>
            </div>
          </div>
        )}
        {err && <p className="text-xs text-danger-600">{err}</p>}
      </div>
    </Modal>
  )
}
