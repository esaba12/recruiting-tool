// The offer decision view (v1.4 spec 04): the offers on the table, side by side, and
// everything else still in process with an "ask to expedite" draft for each. A panel
// body, opened from Today's Decisions card or an Offer-stage application.
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { updateApplication } from '../../db.js'
import { STAGE_COLOR, Badge, fmt, daysUntil } from '../../shared.jsx'
import { offerDecisions } from '../../lib/attention.js'
import { OFFER_DETAIL_FIELDS, inProcessRows, expediteContext, expediteTemplate } from '../../lib/offers.js'
import EmailDraft from '../today/EmailDraft.jsx'
import Mono from '../ui/Mono.jsx'

const INPUT = 'w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400'

function deadlineLabel(deadline) {
  if (!deadline) return null
  const days = daysUntil(deadline)
  return days < 0 ? `${-days}d past` : days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`
}

// One offer's deadline and details, saved to offer_deadline / offer_details. Shared with
// ApplicationPanelBody's Offer section.
export function OfferForm({ app, onSaved }) {
  const [offer, setOffer] = useState(() => ({
    deadline: app.offerDeadline || '',
    ...Object.fromEntries(OFFER_DETAIL_FIELDS.map(f => [f.key, app.offerDetails?.[f.key] || ''])),
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    setSaving(true); setError(null)
    try {
      const details = Object.fromEntries(OFFER_DETAIL_FIELDS.map(f => [f.key, offer[f.key].trim()]).filter(([, v]) => v))
      await updateApplication(app.id, { offerDeadline: offer.deadline || null, offerDetails: Object.keys(details).length ? details : null })
      onSaved?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {error && <p className="text-xs text-danger-700 mb-2">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-ink-400 mb-0.5">Decide By</label>
          <input type="date" value={offer.deadline} onChange={e => setOffer(o => ({ ...o, deadline: e.target.value }))} className={INPUT} />
        </div>
        {OFFER_DETAIL_FIELDS.map(f => (
          <div key={f.key} className={f.wide ? 'col-span-2' : undefined}>
            <label className="block text-xs text-ink-400 mb-0.5">{f.label}</label>
            <input value={offer[f.key]} placeholder={f.placeholder} onChange={e => setOffer(o => ({ ...o, [f.key]: e.target.value }))} className={INPUT} />
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving}
        className="w-full mt-3 py-2 bg-ink-900 text-on-fill text-xs rounded-md hover:bg-ink-800 disabled:opacity-50 font-medium transition-colors">
        {saving ? 'Saving...' : 'Save Offer'}
      </button>
    </>
  )
}

// The facts in columns, no scoring: comparing is the user's job.
const MONEY = ['base', 'bonus', 'equity']
function CompareTable({ offers }) {
  const rows = [{ key: 'deadline', label: 'Decide by' }, ...OFFER_DETAIL_FIELDS]
  const cell = (a, key) => key === 'deadline'
    ? (a.offerDeadline ? <Mono className="text-ink-900">{fmt(a.offerDeadline)}</Mono> : null)
    : (a.offerDetails?.[key] ? (MONEY.includes(key) ? <Mono className="text-ink-900">{a.offerDetails[key]}</Mono> : a.offerDetails[key]) : null)
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            <th className="w-20" />
            {offers.map(a => (
              <th key={a.id} className="text-left font-semibold text-ink-900 pb-2 pr-3 align-bottom min-w-28">{a.company}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-t border-ink-100">
              <th scope="row" className="text-left text-xs font-normal text-ink-400 py-2 pr-3 align-top">{r.label}</th>
              {offers.map(a => (
                <td key={a.id} className="py-2 pr-3 align-top text-xs text-ink-700">{cell(a, r.key) ?? <span className="text-ink-300">—</span>}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function InProcessRow({ row, deadline }) {
  const [drafting, setDrafting] = useState(false)
  const { app: a, contact: c } = row
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900 flex items-center gap-2">
            <span className="truncate">{a.company}</span>
            <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
          </p>
          <p className="text-xs text-ink-500 truncate">{[a.role, c ? `Ask ${c.name}` : 'No one on file there'].filter(Boolean).join(' · ')}</p>
        </div>
        <button onClick={() => setDrafting(d => !d)} className="shrink-0 text-xs text-link hover:underline">
          {drafting ? 'Hide' : 'Ask to expedite'}
        </button>
      </div>
      {drafting && (
        <EmailDraft contact={c} kind="expedite" context={expediteContext({ app: a, deadline })} label="Expedite request"
          initialText={expediteTemplate({ contact: c, app: a, deadline })}
          initialSubject={`Timeline question — ${a.role || a.company}`} />
      )}
    </div>
  )
}

export default function OfferPanelBody({ app, apps = [], contacts = [], relationships = [], onBack, onClose, onSaved }) {
  const offers = useMemo(() => offerDecisions(apps), [apps])
  const [focusId, setFocusId] = useState(app.id)
  const focused = offers.find(a => a.id === focusId) || app
  const inProcess = useMemo(() => inProcessRows(apps, contacts, relationships), [apps, contacts, relationships])
  // The ask names the deadline that binds first.
  const deadline = offers.map(a => a.offerDeadline).filter(Boolean).sort()[0] || null
  const left = deadlineLabel(focused.offerDeadline)

  return (
    <>
      <div className="sticky top-0 bg-surface border-b border-ink-100 px-5 py-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {onBack && (
            <button onClick={onBack} aria-label="Back"
              className="shrink-0 w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500">
              <ArrowLeft size={14} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink-900 truncate">Decide on {offers.length > 1 ? `${offers.length} offers` : focused.company}</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              {left
                ? <>{focused.company} · <Mono className={`text-sm ${daysUntil(focused.offerDeadline) <= 3 ? 'text-danger-600 font-semibold' : 'text-ink-700'}`}>{left}</Mono></>
                : 'No deadline on file yet'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="px-5 py-4 border-b border-ink-100">
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">The offer</p>
        {offers.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-3" role="tablist">
            {offers.map(a => (
              <button key={a.id} role="tab" aria-selected={a.id === focused.id} onClick={() => setFocusId(a.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${a.id === focused.id ? 'bg-ink-900 text-on-fill border-ink-900' : 'bg-surface text-ink-600 border-ink-200 hover:border-ink-400'}`}>
                {a.company}
              </button>
            ))}
          </div>
        )}
        <OfferForm key={focused.id} app={focused} onSaved={onSaved} />
      </div>

      {offers.length > 1 && (
        <div className="px-5 py-4 border-b border-ink-100">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">Side by side</p>
          <CompareTable offers={offers} />
        </div>
      )}

      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Still in process <Mono className="text-ink-400">{inProcess.length}</Mono></p>
        <p className="text-[11px] text-ink-400 mt-1 mb-1">
          Each draft names your deadline, not the other company. Edit it, then send it yourself.
        </p>
        {inProcess.length === 0
          ? <p className="text-sm text-ink-500 py-2">Nothing else is moving right now.</p>
          : <div className="divide-y divide-ink-100">{inProcess.map(r => <InProcessRow key={r.app.id} row={r} deadline={deadline} />)}</div>}
      </div>
    </>
  )
}
