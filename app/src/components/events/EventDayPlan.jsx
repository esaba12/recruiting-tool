// Phase 15 sections of the event panel: the booth route / day plan for multi-employer
// events, and "Met someone here" post-event capture. Pure planning lives in
// lib/dayPlan.js; capture reuses QuickAddContactModal + LogInteractionModal through
// their prefill props rather than forking them.
import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { boothRoute, planDay, captureDefaults } from '../../lib/dayPlan.js'
import { resolveEmployerId } from '../../lib/employers.js'
import { useTargetCompanies } from '../../lib/useTargetCompanies.js'
import { updateContact } from '../../db.js'
import { useSuppressSidePanelEscape } from '../ui/SidePanel.jsx'
import QuickAddContactModal from '../QuickAddContactModal.jsx'
import LogInteractionModal from '../LogInteractionModal.jsx'
import Mono from '../ui/Mono.jsx'

const MICRO = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500'
const PRIORITY_LABEL = { interviewing: 'In process', applied: 'Applied', target: 'Target', contact: 'Know someone', other: '' }
const PRIORITY_CLS = {
  interviewing: 'bg-warning-50 text-warning-800 border-warning-200',
  applied: 'bg-ink-100 text-ink-800 border-ink-300',
  target: 'bg-school-100 text-school-700 border-school-200',
  contact: 'bg-success-50 text-success-800 border-success-200',
}

const hhmm = (iso, tz) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

export function DayPlanSection({ event, pool, apps = [], contacts = [], conflicts, tz, minutesPerBooth = 10 }) {
  const { targets } = useTargetCompanies()
  const route = boothRoute(event, { employers: pool.employers, targets, apps, contacts })
  if (route.length < 2) return null // a single-host event doesn't need a route

  // With a calendar read, pack the route into the free windows; without one, the whole
  // event window is the only fragment we know about.
  const fragments = conflicts?.fragments?.length ? conflicts.fragments
    : [{ start: event.startsAt, end: event.endsAt || event.startsAt, minutes: Math.max(0, (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60000) }]
  const plan = planDay(route, fragments, { minutesPerBooth })

  return (
    <section className="px-5 py-4 border-b border-ink-200">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={MICRO}>Booth route</h3>
        <Mono className="text-ink-400">{route.length} employers · ~{minutesPerBooth} min each</Mono>
      </div>
      {plan.blocks.map((b, i) => (
        <div key={i} className="mb-2 last:mb-0">
          <p className="text-[11px] text-ink-500 mb-1">
            <Mono>{hhmm(b.fragment.start, tz)}–{hhmm(b.fragment.end, tz)}</Mono>{conflicts?.fragments?.length ? ' · free window' : ''}
          </p>
          <ol className="border border-ink-200 rounded-sm divide-y divide-ink-100">
            {b.booths.map(s => <BoothRow key={s.employerId} stop={s} time={hhmm(s.at, tz)} />)}
          </ol>
        </div>
      ))}
      {plan.overflow.length > 0 && (
        <p className="mt-2 text-xs text-warning-800">
          No time left for {plan.overflow.map(s => s.name).join(', ')}
          {conflicts?.hardBlocks?.length ? ' around your calendar.' : '.'}
        </p>
      )}
    </section>
  )
}

function BoothRow({ stop, time }) {
  return (
    <li className="flex items-start gap-3 px-2.5 py-1.5">
      <Mono className="text-ink-500 pt-0.5 shrink-0">{time}</Mono>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-medium text-ink-900">{stop.name}</span>
          {PRIORITY_LABEL[stop.priority] && (
            <span className={`px-1.5 py-px border rounded-sm text-[10px] font-semibold uppercase tracking-[0.08em] ${PRIORITY_CLS[stop.priority]}`}>
              {PRIORITY_LABEL[stop.priority]}
            </span>
          )}
        </div>
        {stop.reasons.length > 0 && <p className="text-xs text-ink-500">{stop.reasons.join(' · ')}</p>}
      </div>
    </li>
  )
}

// After (or during) the event: add a person you met, log the conversation, and set the
// event's follow-up so Today nags if it slips.
export function CaptureSection({ event, pool, contacts = [], onContactsChanged }) {
  const [step, setStep] = useState(null) // null | 'contact' | { contact }
  const [error, setError] = useState(null)
  const [done, setDone] = useState([])
  const addDone = name => setDone(d => d.includes(name) ? d : [...d, name])
  useSuppressSidePanelEscape(step !== null)
  const defaults = captureDefaults(event)
  const started = Date.parse(event.startsAt) <= Date.now()
  const userEvent = pool.userEventsById.get(event.id)

  async function afterContact({ id, name, company }) {
    try {
      const employerId = resolveEmployerId(company, pool.employers)
      if (employerId) await updateContact(id, { employerId })
      if (!userEvent?.followupDueAt) {
        await pool.updateUserEvent(event.id, { followupDueAt: new Date(`${defaults.followUpDate}T09:00:00`).toISOString() })
      }
      setStep({ contact: { id, name, company } })
    } catch (e) { setError(e.message); setStep(null) }
  }

  return (
    <section className="px-5 py-4 border-b border-ink-200">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={MICRO}>People you met</h3>
        {done.length > 0 && <Mono className="text-ink-400">{done.length} added</Mono>}
      </div>
      {!started && <p className="text-xs text-ink-500 mb-2">Use this at the event: add each person as you leave their booth.</p>}
      <button onClick={() => { setError(null); setStep('contact') }}
        className="flex items-center gap-1.5 px-2.5 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-700 hover:bg-ink-50">
        <UserPlus size={13} /> Met someone here
      </button>
      {done.length > 0 && <p className="mt-2 text-xs text-ink-600">{done.join(', ')}</p>}
      <p className="mt-1.5 text-[11px] text-ink-400">
        Adds them to Network, logs a Meeting on <Mono>{defaults.date}</Mono>, and sets this event's follow-up for <Mono>{defaults.followUpDate}</Mono>.
      </p>
      {error && <p className="mt-1.5 text-xs text-danger-700">{error}</p>}

      {step === 'contact' && (
        <QuickAddContactModal contacts={contacts} title={`Met at ${event.title}`}
          extraFields={{ followUpDate: defaults.followUpDate, lastInteraction: defaults.date }}
          onClose={() => setStep(null)} onSaved={afterContact} />
      )}
      {step?.contact && (
        <LogInteractionModal contacts={contacts} contact={step.contact}
          initialChannel="meeting" initialDate={defaults.date} initialNotes={defaults.notes}
          onClose={() => { addDone(step.contact.name); setStep(null) }}
          onSaved={() => { addDone(step.contact.name); setStep(null); onContactsChanged?.() }} />
      )}
    </section>
  )
}
