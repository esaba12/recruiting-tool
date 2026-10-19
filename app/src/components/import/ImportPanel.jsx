import { useState } from 'react'
import { Upload, AlertTriangle, Loader2, Check } from 'lucide-react'
import Button from '../ui/Button.jsx'
import Mono from '../ui/Mono.jsx'
import Modal from '../ui/Modal.jsx'
import { STAGE_COLOR, Badge } from '../../shared.jsx'
import { parseTrackerCsv, parseLinkedInCsv } from '../../lib/trackerImport.js'
import { addApplications, addImportedContacts } from '../../db.js'

// Bring existing data in (v1.4 spec 01): an application tracker → Pipeline, or LinkedIn's
// Connections.csv → Network. Pure parsing, no AI key. Nothing is written until "Add N", and
// rows already tracked are skipped, so importing the same file twice adds nothing.
// ImportPanel has no chrome so the onboarding wizard can host it; ImportModal wraps it.

const KINDS = {
  tracker: {
    title: 'Import your application tracker',
    blurb: 'A CSV from Google Sheets, Excel or Notion, or rows pasted straight from the sheet.',
    columns: <>Columns are found by name: <Mono>Company</Mono> (or Firm), plus any of <Mono>Role</Mono>, <Mono>Status</Mono>, <Mono>Date Applied</Mono>, <Mono>Link</Mono>, <Mono>Location</Mono>, <Mono>Notes</Mono>.</>,
    placeholder: 'Company\tRole\tStatus\tDate Applied\nGoldman Sachs\tSummer Analyst\tSuperday\t9/3/2026',
    parse: (text, ctx) => parseTrackerCsv(text, { existingApps: ctx.apps }),
    write: addApplications,
    noun: n => `application${n === 1 ? '' : 's'}`,
    already: 'already tracked',
  },
  linkedin: {
    title: 'Import your LinkedIn connections',
    blurb: 'LinkedIn → Settings & Privacy → Data privacy → Get a copy of your data → Connections. LinkedIn emails you the file, usually within 10 minutes.',
    columns: <>Upload <Mono>Connections.csv</Mono> as LinkedIn sends it. Connections come in as Cold contacts and stay out of Keep in Touch until you log something with them.</>,
    placeholder: 'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
    parse: (text, ctx) => parseLinkedInCsv(text, { existingContacts: ctx.contacts }),
    write: addImportedContacts,
    noun: n => `contact${n === 1 ? '' : 's'}`,
    already: 'already in your network',
  },
}

const TRACKER_FIELD_LABEL = { company: 'Company', role: 'Role', stage: 'Status', appliedDate: 'Applied', jdLink: 'Link', location: 'Location', notes: 'Notes' }

export function ImportPanel({ kind, apps = [], contacts = [], onImported, compact = false }) {
  const k = KINDS[kind]
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(null) // number written so far, while writing
  const [added, setAdded] = useState(null)
  // Rows written this session also count as existing: the parent's list may not refresh until close.
  const [session, setSession] = useState([])

  function read(raw) {
    setError(null); setAdded(null)
    const out = k.parse(raw, { apps: [...apps, ...session], contacts: [...contacts, ...session] })
    setParsed(out)
    if (out.error) setError(out.error)
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (/\.xlsx?$/i.test(file.name)) { setError('Save the sheet as CSV first (File → Download → .csv), or copy the rows and paste them below.'); return }
    const raw = await file.text()
    setText('')
    read(raw)
  }

  async function commit() {
    const rows = parsed.rows
    setProgress(0); setError(null)
    try {
      const n = await k.write(rows, { onProgress: setProgress })
      setAdded(n)
      setSession(s => [...s, ...rows])
      setParsed(null); setText('')
      onImported?.(n)
    } catch (e) {
      setError(e.message)
    } finally {
      setProgress(null)
    }
  }

  const rows = parsed?.rows || []
  const busy = progress !== null
  return (
    <div className="space-y-3">
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{k.title}</h2>
          <p className="text-xs text-ink-500 mt-0.5">{k.blurb}</p>
        </div>
      )}
      {compact && <p className="text-xs text-ink-500">{k.blurb}</p>}

      <label className="flex items-center justify-center gap-2 border border-dashed border-ink-300 p-4 text-sm text-ink-600 cursor-pointer hover:border-accent-500 hover:text-ink-900">
        <Upload size={15} /> Choose a .csv file
        <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls,text/csv" className="hidden" onChange={onFile} disabled={busy} />
      </label>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={compact ? 3 : 4} disabled={busy}
        placeholder={`…or paste rows here, header first:\n${k.placeholder}`}
        className="w-full px-3 py-2 border border-ink-200 bg-surface text-xs font-mono focus:outline-none focus:border-accent-500" />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-ink-400 flex-1 min-w-[14rem]">{k.columns} No AI key needed.</p>
        <Button size="sm" variant="secondary" onClick={() => read(text)} disabled={busy || !text.trim()}>Read rows</Button>
      </div>

      {error && <p className="text-xs text-danger-700 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> {error}</p>}
      {added !== null && (
        <p className="text-sm text-success-700 flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} /> Added <Mono>{added}</Mono> {k.noun(added)}.</p>
      )}

      {parsed && !parsed.error && (
        <div className="space-y-2">
          <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap border-b border-ink-900 pb-1 text-xs">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-700">Preview</span>
            <span><Mono className="text-ink-900 font-semibold">{rows.length}</Mono> new</span>
            {parsed.duplicates > 0 && <span className="text-ink-500"><Mono>{parsed.duplicates}</Mono> {k.already}</span>}
            {parsed.skipped > 0 && <span className="text-ink-500"><Mono>{parsed.skipped}</Mono> skipped ({kind === 'tracker' ? 'no company' : 'no name'})</span>}
          </div>
          {kind === 'tracker' && parsed.mapping && (
            <p className="text-[11px] text-ink-400">
              Reading {Object.entries(TRACKER_FIELD_LABEL).filter(([f]) => parsed.mapping[f] != null)
                .map(([f, label]) => `${label} ← "${parsed.headers[parsed.mapping[f]]}"`).join(' · ')}
            </p>
          )}
          {rows.length > 0 && (
            <div className="border border-ink-200 divide-y divide-ink-100 max-h-[34vh] overflow-y-auto">
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs min-w-0">
                  {kind === 'tracker' ? <>
                    <span className="font-medium text-ink-900 truncate">{r.company}</span>
                    <span className="text-ink-500 truncate flex-1">{r.role}</span>
                    <Badge label={r.stage} color={STAGE_COLOR[r.stage]} />
                    {r.appliedDate && <Mono className="text-ink-400 shrink-0">{r.appliedDate}</Mono>}
                  </> : <>
                    <span className="font-medium text-ink-900 truncate">{r.name}</span>
                    <span className="text-ink-500 truncate flex-1">{[r.title, r.company].filter(Boolean).join(' @ ')}</span>
                    {r.connectedOn && <Mono className="text-ink-400 shrink-0">{r.connectedOn}</Mono>}
                  </>}
                </div>
              ))}
              {rows.length > 8 && <p className="px-3 py-1.5 text-[11px] text-ink-400">and <Mono>{rows.length - 8}</Mono> more</p>}
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" onClick={commit} disabled={busy || rows.length === 0}>
              {busy
                ? <><Loader2 size={14} className="inline animate-spin mr-1" />Adding <Mono>{progress}</Mono>/<Mono>{rows.length}</Mono>…</>
                : rows.length ? `Add ${rows.length} ${k.noun(rows.length)}` : 'Nothing new to add'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportModal({ onClose, ...props }) {
  return (
    <Modal onClose={onClose} size="lg">
      <div className="p-5">
        <ImportPanel {...props} />
        <div className="flex justify-end mt-4 pt-3 border-t border-ink-200">
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
