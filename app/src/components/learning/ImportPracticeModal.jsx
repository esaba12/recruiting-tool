import { useState, useMemo, useRef } from 'react'
import { ClipboardPaste, Table2, Image as ImageIcon, Loader2, Sparkles, AlertTriangle, Download, X, Upload } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Tabs from '../ui/Tabs.jsx'
import Mono from '../ui/Mono.jsx'
import NeedsKey from '../onboarding/NeedsKey.jsx'
import { aiProviderLabel } from '../../lib/ai.js'
import { downscaleImage, MAX_UPLOAD_BYTES } from '../../lib/image.js'
import { todayLocal } from '../../lib/dates.js'
import {
  parsePracticeCsv, extractPracticeFromText, extractPracticeFromImage, practiceCsvTemplate, IMPORT_KINDS,
} from '../../lib/learning/practiceImport.js'

// Bulk practice import for any track: paste text, a CSV / spreadsheet rows, or a screenshot
// → editable drafts → one commit. Same "AI drafts, human confirms" shape as
// EventImportModal — nothing is written until "Import N". Re-importing the same source is a
// no-op (fingerprinted in practiceImport.js's draftsToLogs).

const MODES = [
  { key: 'paste', label: 'Paste', icon: ClipboardPaste },
  { key: 'csv', label: 'Spreadsheet', icon: Table2 },
  { key: 'image', label: 'Screenshot', icon: ImageIcon },
]
const KIND_LABEL = { session: 'Study', mock: 'Mock', assessment: 'OA / test', problem: 'Problem' }
const ORIGIN_LABEL = { csv: 'sheet', paste: 'paste', screenshot: 'image' }
const field = 'px-2 py-1 border border-ink-200 bg-surface text-xs focus:outline-none focus:border-accent-500'

export default function ImportPracticeModal({ view, learning, onClose, isDemoMode = false }) {
  const topics = view.visible
  const ctx = { trackName: view.track.name, topics, today: todayLocal() }
  const [mode, setMode] = useState('paste')
  const [text, setText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [image, setImage] = useState(null) // { preview, base64 }
  const [drafts, setDrafts] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)
  const topicById = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics])

  const stage = (out, skipped = 0) => {
    setDrafts(prev => [...prev, ...out])
    setResult(null)
    setNotice(out.length
      ? `${out.length} draft${out.length === 1 ? '' : 's'} added${skipped ? ` · ${skipped} row${skipped === 1 ? '' : 's'} skipped (no date, or no topic/title)` : ''}`
      : null)
  }

  async function run(fn) {
    setBusy(true); setError(null); setNotice(null)
    try { await fn() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const extractText = () => run(async () => {
    const out = await extractPracticeFromText(text, ctx)
    if (!out.length) throw new Error('No dated practice found in that text. Add the dates if the source doesn\'t have them.')
    stage(out); setText('')
  })

  const parseCsvNow = (body = csvText) => run(async () => {
    const { drafts: out, skipped, error: err } = parsePracticeCsv(body, ctx)
    if (err) throw new Error(err)
    if (!out.length) throw new Error(skipped ? `No usable rows — ${skipped} skipped (each row needs a date and a topic or title).` : 'Nothing to import.')
    stage(out, skipped); setCsvText('')
  })

  async function onCsvFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('File too large (2 MB max). Export just the practice tab.'); return }
    if (/\.xlsx?$/i.test(file.name)) { setError('Save the sheet as CSV first (File → Download → .csv), or copy the rows and paste them below.'); return }
    parseCsvNow(await file.text())
  }

  function downloadTemplate() {
    const blob = new Blob([practiceCsvTemplate(topics)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${view.track.name.replace(/[^\w-]+/g, '-').toLowerCase()}-practice.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  async function takeImage(file) {
    setError(null)
    if (!file?.type?.startsWith('image/')) { setError('That file doesn\'t look like an image.'); return }
    if (file.size > MAX_UPLOAD_BYTES) { setError('Image too large (20 MB max).'); return }
    try {
      const dataUrl = await downscaleImage(file)
      setImage({ preview: dataUrl, base64: dataUrl.split(',')[1] })
    } catch { setError('Could not read that image — try a different file.') }
  }

  const extractImage = () => run(async () => {
    const out = await extractPracticeFromImage({ imageBase64: image.base64, text }, ctx)
    if (!out.length) throw new Error('No dated practice found in that screenshot. Add the date in the box below it and try again.')
    stage(out); setImage(null); setText('')
  })

  const patch = (i, fields) => setDrafts(prev => prev.map((d, j) => (j === i ? { ...d, ...fields } : d)))
  const remove = i => setDrafts(prev => prev.filter((_, j) => j !== i))

  const commit = () => run(async () => {
    const res = await learning.importPractice(view.track.id, drafts)
    setResult(res); setDrafts([]); setNotice(null)
  })

  const unmatched = drafts.filter(d => !d.topicIds.length).length

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5 space-y-4" onPaste={mode === 'image' ? e => {
        const item = [...e.clipboardData.items].find(x => x.type.startsWith('image/'))
        if (item) { e.preventDefault(); takeImage(item.getAsFile()) }
      } : undefined}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">Import practice · {view.track.name}</p>
          <h2 className="text-lg font-semibold text-ink-900 mt-0.5">Bring in what you did elsewhere</h2>
          <p className="text-xs text-ink-500 mt-0.5">Mock feedback, a tracking sheet, a score screen. You review everything before it's saved, and importing the same thing twice won't double it.</p>
        </div>
        <Tabs options={MODES} value={mode} onChange={m => { setMode(m); setError(null) }} />

        {mode === 'paste' && (
          <div className="space-y-2">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={7}
              placeholder={'Paste anything with dates in it, e.g.\n\nOct 3 — mock with Jane (DCF, LBO). 4/5. Missed WACC inputs.\nOct 5 — 3 market sizing cases, ~90 min'}
              className="w-full px-3 py-2 border border-ink-200 text-sm font-mono leading-relaxed focus:outline-none focus:border-accent-500" />
            <NeedsKey kind="ai"><Button size="sm" onClick={extractText} disabled={busy || !text.trim() || isDemoMode}>
              {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <Sparkles size={14} className="inline -mt-0.5 mr-1" />}Read with {aiProviderLabel()}
            </Button></NeedsKey>
          </div>
        )}

        {mode === 'csv' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <label className="flex items-center justify-center gap-2 border border-dashed border-ink-300 p-4 text-sm text-ink-600 cursor-pointer hover:border-accent-500 hover:text-ink-900">
                <Upload size={16} /> Choose a .csv file
                <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" className="hidden" onChange={onCsvFile} />
              </label>
              <button onClick={downloadTemplate} className="flex items-center justify-center gap-1.5 border border-ink-200 px-3 text-xs text-ink-600 hover:border-ink-500 hover:text-ink-900 py-2">
                <Download size={13} /> Template for {view.track.name}
              </button>
            </div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={4}
              placeholder={'…or paste rows copied from Google Sheets / Excel (with the header row)'}
              className="w-full px-3 py-2 border border-ink-200 text-xs font-mono focus:outline-none focus:border-accent-500" />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-ink-400">Columns are found by name: <Mono>Date</Mono> plus <Mono>Topic</Mono> or <Mono>Title</Mono>; optional <Mono>Type</Mono>, <Mono>Result</Mono>, <Mono>Minutes</Mono>, <Mono>Score</Mono>, <Mono>Notes</Mono>. No AI key needed.</p>
              <Button size="sm" variant="secondary" onClick={() => parseCsvNow()} disabled={busy || !csvText.trim()}>Read rows</Button>
            </div>
          </div>
        )}

        {mode === 'image' && (
          <div className="space-y-2">
            {image ? (
              <div className="relative inline-block">
                <img src={image.preview} alt="Screenshot to import" className="max-h-48 border border-ink-200" />
                <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-ink-900 text-on-fill p-0.5" title="Remove"><X size={12} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); takeImage(e.dataTransfer.files?.[0]) }}
                className="w-full border border-dashed border-ink-300 p-6 text-sm text-ink-600 hover:border-accent-500 hover:text-ink-900 flex flex-col items-center gap-1">
                <ImageIcon size={18} />
                <span>Paste a screenshot (<Mono>⌘V</Mono>), drop one here, or click to choose</span>
                <span className="text-[11px] text-ink-400">Score screens, mock feedback pages, a tracker. Read with Claude, so it needs an Anthropic key.</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { takeImage(e.target.files?.[0]); e.target.value = '' }} />
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Optional context, e.g. “all from Oct 6”, “this was a DCF mock”"
              className="w-full px-3 py-1.5 border border-ink-200 text-sm focus:outline-none focus:border-accent-500" />
            <NeedsKey kind="ai"><Button size="sm" onClick={extractImage} disabled={busy || !image || isDemoMode}>
              {busy ? <Loader2 size={14} className="inline animate-spin mr-1" /> : <Sparkles size={14} className="inline -mt-0.5 mr-1" />}Read with Claude
            </Button></NeedsKey>
          </div>
        )}

        {error && <p className="text-xs text-danger-700 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}</p>}
        {notice && <p className="text-xs text-ink-500 font-mono">{notice}</p>}

        {drafts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 border-b border-ink-900 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-700">Review · {drafts.length}</p>
              {unmatched > 0 && <p className="text-[11px] text-warning-700">{unmatched} without a topic: they count toward activity and goals, not topic levels</p>}
            </div>
            <div className="max-h-[42vh] overflow-y-auto divide-y divide-ink-100 border border-ink-200">
              {drafts.map((d, i) => (
                <DraftRow key={i} d={d} topics={topics} topicById={topicById}
                  onPatch={f => patch(i, f)} onRemove={() => remove(i)} />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setDrafts([]); setNotice(null) }} disabled={busy}>Clear</Button>
              <Button size="sm" onClick={commit} disabled={busy}>{busy ? 'Importing…' : `Import ${drafts.length}`}</Button>
            </div>
          </div>
        )}

        {result && (
          <div className="border-l-2 border-success-500 bg-success-50 px-3 py-2 text-xs text-success-800 flex items-center justify-between gap-2">
            <span>Imported {result.imported}{result.duplicates ? ` · ${result.duplicates} already there, skipped` : ''}.</span>
            <button onClick={onClose} className="font-semibold hover:underline">Done</button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function DraftRow({ d, topics, topicById, onPatch, onRemove }) {
  const available = topics.filter(t => !d.topicIds.includes(t.id))
  return (
    <div className="p-2.5 space-y-1.5 learn-rise">
      <div className="flex items-center gap-1.5">
        <input type="date" value={d.date} max={todayLocal()} onChange={e => e.target.value && onPatch({ date: e.target.value })} className={`${field} font-mono w-[8.5rem]`} />
        <input value={d.title} onChange={e => onPatch({ title: e.target.value })} className={`${field} flex-1 min-w-0 text-sm font-medium`} />
        <select value={d.kind} onChange={e => onPatch({ kind: e.target.value })} className={field}>
          {IMPORT_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
        <button onClick={onRemove} className="text-ink-300 hover:text-danger-600 p-1" title="Remove"><X size={14} /></button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {d.topicIds.map(id => (
          <span key={id} className="inline-flex items-center gap-1 bg-ink-900 text-on-fill text-[11px] pl-1.5 pr-1 py-0.5">
            {topicById.get(id)?.name || 'topic'}
            <button onClick={() => onPatch({ topicIds: d.topicIds.filter(x => x !== id) })} className="text-ink-300 hover:text-white"><X size={10} /></button>
          </span>
        ))}
        {available.length > 0 && (
          <select value="" onChange={e => e.target.value && onPatch({ topicIds: [...d.topicIds, e.target.value], unmatchedTopic: null })} className={`${field} text-ink-500 max-w-[9rem]`}>
            <option value="">+ topic</option>
            {available.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        {d.unmatchedTopic && <span className="text-[11px] text-warning-700">“{d.unmatchedTopic}” isn't a topic here</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wider text-ink-400">min</label>
          <input type="number" min="0" value={d.minutes ?? ''} onChange={e => onPatch({ minutes: e.target.value === '' ? null : Number(e.target.value) })} className={`${field} w-14 font-mono`} />
          <label className="text-[10px] uppercase tracking-wider text-ink-400">score /5</label>
          <input type="number" min="0" max="5" step="0.1" value={d.score ?? ''} onChange={e => onPatch({ score: e.target.value === '' ? null : Math.min(5, Math.max(0, Number(e.target.value))) })} className={`${field} w-14 font-mono`} />
          <Mono className="text-[10px] text-ink-300">{ORIGIN_LABEL[d.origin] || d.origin}</Mono>
        </span>
      </div>
      {d.notes && <input value={d.notes} onChange={e => onPatch({ notes: e.target.value })} className={`${field} w-full text-ink-600`} />}
    </div>
  )
}
