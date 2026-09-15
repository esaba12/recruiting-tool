import { useState, useMemo } from 'react'
import { ClipboardPaste, Upload, PencilLine, Loader2, Sparkles, AlertTriangle, Copy } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import Tabs from './ui/Tabs.jsx'
import Mono from './ui/Mono.jsx'
import { Badge } from '../shared.jsx'
import { AI_PROVIDER_LABEL } from '../lib/ai.js'
import { extractFromPaste, parseCsv, parseIcs, manualDraft, contributeDrafts } from '../lib/eventImport.js'
import { annotateDuplicates, gateVisibility, SHARE_CONFIDENCE, EVENT_KINDS } from '../lib/ingest/contribute.js'
import { wallClock, localToIso, parseCompactLocal } from '../lib/ingest/tz.js'

// Paste / upload / manual → staged, editable drafts → explicit commit. Same
// "AI drafts, human confirms" shape as QuickCaptureModal: nothing is written
// until Commit, every draft card is editable, and each one shows where it will
// land (shared with campus vs. private) and whether it duplicates a pool event.
// Sources behind campus SSO (Handshake, Career Fair Plus, 12twenty) enter here —
// we never scrape those sessions; the student pastes what they can already see.

const MODES = [
  { key: 'paste', label: 'Paste', icon: ClipboardPaste },
  { key: 'upload', label: 'CSV / ICS', icon: Upload },
  { key: 'manual', label: 'Manual', icon: PencilLine },
]
const KIND_LABEL = { career_fair: 'Career fair', info_session: 'Info session', coffee_chat: 'Coffee chat', workshop: 'Workshop', networking: 'Networking', other: 'Other' }

function toLocalInput(iso, tz) {
  if (!iso) return ''
  const w = wallClock(Date.parse(iso), tz)
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}T${String(w.hh).padStart(2, '0')}:${String(w.mm).padStart(2, '0')}`
}

export default function EventImportModal({ school, poolEvents = [], onClose, onCommitted }) {
  const tz = school?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const [mode, setMode] = useState('paste')
  const [text, setText] = useState('')
  const [manual, setManual] = useState({ title: '', kind: 'info_session', start: '', end: '', location: '', employerName: '', registrationUrl: '' })
  const [drafts, setDrafts] = useState([])          // [{ ...draft, share, duplicateOf }]
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  const stage = raw => {
    const annotated = annotateDuplicates(raw, poolEvents).map(d => ({ ...d, share: d.confidence >= SHARE_CONFIDENCE }))
    setDrafts(prev => [...prev, ...annotated])
  }

  async function extract() {
    setBusy(true); setError(null)
    try {
      if (!text.trim()) throw new Error('Paste something first')
      const out = await extractFromPaste(text, { timezone: tz })
      if (!out.length) throw new Error('No dated events found in that text')
      stage(out); setText('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (file.size > 2 * 1024 * 1024) { setError('File too large (2 MB max)'); return }
    const body = await file.text()
    if (/^BEGIN:VCALENDAR/m.test(body)) { const out = parseIcs(body, { timezone: tz }); out.length ? stage(out) : setError('No events in that .ics') }
    else { const { drafts: out, skipped, error: err } = parseCsv(body, { timezone: tz }); if (err) setError(err); else { stage(out); if (skipped) setError(`${skipped} row(s) skipped (missing title or date)`) } }
    e.target.value = ''
  }

  function addManual() {
    const d = manualDraft({ ...manual, timezone: tz, employerName: manual.employerName || null, registrationUrl: manual.registrationUrl || null })
    if (!d) { setError('Title and start are required'); return }
    stage([d]); setManual(m => ({ ...m, title: '', start: '', end: '' })); setError(null)
  }

  const patch = (i, fields) => setDrafts(prev => prev.map((d, j) => j === i ? { ...d, ...fields } : d))
  const remove = i => setDrafts(prev => prev.filter((_, j) => j !== i))

  async function commit() {
    setBusy(true); setError(null)
    try {
      const shared = drafts.filter(d => d.share)
      const priv = drafts.filter(d => !d.share)
      const out = []
      if (shared.length) out.push(...(await contributeDrafts(shared, { share: true })).results)
      if (priv.length) out.push(...(await contributeDrafts(priv, { share: false })).results)
      setResults(out); setDrafts([])
      onCommitted?.(out)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const counts = useMemo(() => ({
    shared: drafts.filter(d => d.share && !d.duplicateOf && d.confidence >= SHARE_CONFIDENCE).length,
    priv: drafts.filter(d => !d.duplicateOf && (!d.share || d.confidence < SHARE_CONFIDENCE)).length,
    dup: drafts.filter(d => d.duplicateOf).length,
  }), [drafts])

  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Import events</h2>
            <p className="text-xs text-ink-400">Handshake, Career Fair Plus, emails, flyers — paste what you can see, or upload a CSV/ICS. Reviewed here, then shared with everyone at {school?.name || 'your campus'} (or kept private).</p>
          </div>
          <Tabs options={MODES} value={mode} onChange={setMode} />
        </div>

        {mode === 'paste' && (
          <div className="space-y-2">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={7} placeholder="Paste a listing, an email, or a copied table…"
              className="w-full px-3 py-2 border border-ink-100 rounded-md text-sm font-mono focus:outline-none focus:border-accent-400" />
            <Button size="sm" onClick={extract} disabled={busy || !text.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Extract with {AI_PROVIDER_LABEL}
            </Button>
          </div>
        )}
        {mode === 'upload' && (
          <label className="block border border-dashed border-ink-200 rounded-md p-6 text-center text-sm text-ink-500 cursor-pointer hover:border-accent-400">
            <Upload size={18} className="mx-auto mb-1" /> Choose a .csv or .ics file
            <input type="file" accept=".csv,.ics,text/csv,text/calendar" className="hidden" onChange={onFile} />
            <p className="text-[11px] text-ink-400 mt-1">CSV needs at least a title and a date column; other columns (end, location, company, link, registration) are picked up by header name.</p>
          </label>
        )}
        {mode === 'manual' && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <input className="col-span-2 px-2.5 py-1.5 border border-ink-100 rounded-md" placeholder="Title" value={manual.title} onChange={e => setManual(m => ({ ...m, title: e.target.value }))} />
            <select className="px-2.5 py-1.5 border border-ink-100 rounded-md" value={manual.kind} onChange={e => setManual(m => ({ ...m, kind: e.target.value }))}>
              {EVENT_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input className="px-2.5 py-1.5 border border-ink-100 rounded-md" placeholder="Employer (optional)" value={manual.employerName} onChange={e => setManual(m => ({ ...m, employerName: e.target.value }))} />
            <input type="datetime-local" className="px-2.5 py-1.5 border border-ink-100 rounded-md font-mono text-xs" value={manual.start} onChange={e => setManual(m => ({ ...m, start: e.target.value }))} />
            <input type="datetime-local" className="px-2.5 py-1.5 border border-ink-100 rounded-md font-mono text-xs" value={manual.end} onChange={e => setManual(m => ({ ...m, end: e.target.value }))} />
            <input className="px-2.5 py-1.5 border border-ink-100 rounded-md" placeholder="Location" value={manual.location} onChange={e => setManual(m => ({ ...m, location: e.target.value }))} />
            <input className="px-2.5 py-1.5 border border-ink-100 rounded-md" placeholder="Registration link" value={manual.registrationUrl} onChange={e => setManual(m => ({ ...m, registrationUrl: e.target.value }))} />
            <div className="col-span-2"><Button size="sm" variant="secondary" onClick={addManual}>Add to review</Button></div>
          </div>
        )}

        {error && <p className="text-xs text-danger-700 flex items-center gap-1"><AlertTriangle size={12} /> {error}</p>}

        {drafts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink-700">Review {drafts.length} draft{drafts.length > 1 ? 's' : ''}</p>
              <p className="text-[11px] text-ink-400 font-mono">{counts.shared} to campus · {counts.priv} private · {counts.dup} merge</p>
            </div>
            <div className="max-h-[40vh] overflow-y-auto divide-y divide-ink-100 border border-ink-100 rounded-md">
              {drafts.map((d, i) => {
                const gate = gateVisibility(d, { share: d.share })
                return (
                  <div key={i} className="p-3 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <input className="flex-1 px-2 py-1 border border-ink-100 rounded-md text-sm font-medium" value={d.title} onChange={e => patch(i, { title: e.target.value })} />
                      <select className="px-2 py-1 border border-ink-100 rounded-md text-xs" value={d.kind} onChange={e => patch(i, { kind: e.target.value })}>
                        {EVENT_KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select>
                      <button className="text-xs text-ink-400 hover:text-danger-600" onClick={() => remove(i)}>Remove</button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input type="datetime-local" className="px-2 py-1 border border-ink-100 rounded-md font-mono text-xs" value={toLocalInput(d.startsAt, tz)}
                        onChange={e => { const v = e.target.value; if (v) patch(i, { startsAt: localToIso(parseCompactLocal(v), tz) }) }} />
                      <input type="datetime-local" className="px-2 py-1 border border-ink-100 rounded-md font-mono text-xs" value={toLocalInput(d.endsAt, tz)}
                        onChange={e => { const v = e.target.value; patch(i, { endsAt: v ? localToIso(parseCompactLocal(v), tz) : null }) }} />
                      <input className="px-2 py-1 border border-ink-100 rounded-md text-xs" placeholder="Location" value={d.location || ''} onChange={e => patch(i, { location: e.target.value })} />
                      <input className="px-2 py-1 border border-ink-100 rounded-md text-xs" placeholder="Employer" value={d.employerName || ''} onChange={e => patch(i, { employerName: e.target.value })} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Mono>conf {d.confidence.toFixed(2)}</Mono>
                      <Badge label={d.sourceKind} />
                      {d.duplicateOf
                        ? <span className="flex items-center gap-1 text-warning-700"><Copy size={11} /> Matches "{d.duplicateOf.title}" already in the pool — will merge, not duplicate</span>
                        : <>
                          <label className="flex items-center gap-1 text-ink-600">
                            <input type="checkbox" checked={d.share} onChange={e => patch(i, { share: e.target.checked })} /> Share with campus
                          </label>
                          <span className={gate.visibility === 'shared' ? 'text-success-700' : 'text-ink-400'}>
                            → {gate.visibility}{gate.reason ? ` (${gate.reason})` : ''}
                          </span>
                        </>}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDrafts([])} disabled={busy}>Clear</Button>
              <Button size="sm" onClick={commit} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : null} Commit {drafts.length}</Button>
            </div>
          </div>
        )}

        {results && (
          <div className="border border-ink-100 rounded-md p-3 text-xs space-y-1">
            <p className="font-medium text-ink-700">Committed</p>
            {results.map((r, i) => (
              <p key={i} className="flex items-center gap-2">
                <Badge label={r.status} color={r.status === 'shared' ? 'bg-success-50 text-success-700' : r.status === 'rejected' ? 'bg-danger-50 text-danger-700' : 'bg-ink-100 text-ink-600'} />
                <span className="text-ink-700">{r.title || r.eventId}</span>
                {r.reason && <span className="text-ink-400">— {r.reason}</span>}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  )
}
