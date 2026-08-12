import { useState } from 'react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, TERMINAL_STAGES, daysSince, daysUntil, fmt, Badge, EmptyState, isUntriaged, isOverdue, isStaleApplication } from '../shared.jsx'
import { updateContact, addInteraction, updateApplication } from '../db.js'
import DraftPanel from './DraftPanel.jsx'

export default function ActionsTab({ contacts, apps, interactions = [], onRefresh }) {
  const activeApps = apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))

  // OAs with a known due date (from the email itself, or the lib/oaResearch.js cloud-agent
  // fallback) sort soonest-first; OAs where research already ran and found no stated deadline
  // sort after, since there's no date to rank them by — same "known dates first, undated last"
  // convention as scheduleContacts below.
  const oaDueApps = apps
    .filter(a => a.oaDueDate && !a.oaCompleted)
    .sort((a, b) => daysUntil(a.oaDueDate) - daysUntil(b.oaDueDate))
  const oaNeedsCheckApps = apps
    .filter(a => a.oaLink && !a.oaDueDate && !a.oaCompleted && a.oaResearchCheckedAt)

  // People explicitly queued via "+ Schedule" — soonest Schedule By first, no-date last
  // (added quickly and not yet given an urgency, not "not urgent").
  const scheduleContacts = contacts
    .filter(c => c.wantsToSchedule)
    .sort((a, b) => {
      if (!a.scheduleBy && !b.scheduleBy) return 0
      if (!a.scheduleBy) return 1
      if (!b.scheduleBy) return -1
      return new Date(a.scheduleBy) - new Date(b.scheduleBy)
    })

  const overdueContacts = contacts
    .filter(isOverdue)
    .sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

  const staleApps = activeApps
    .filter(isStaleApplication)
    .sort((a, b) => {
      const da = a.daysInStage ?? daysSince(a.lastActivity)
      const db = b.daysInStage ?? daysSince(b.lastActivity)
      return db - da
    })

  const highUrgencyContacts = contacts.filter(c =>
    c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
  )

  if (scheduleContacts.length + overdueContacts.length + staleApps.length + highUrgencyContacts.length + oaDueApps.length + oaNeedsCheckApps.length === 0) {
    return <EmptyState msg="✓ Nothing overdue. You're on top of it." />
  }

  return (
    <div className="space-y-4">
      {(oaDueApps.length > 0 || oaNeedsCheckApps.length > 0) && (
        <Section title={`Online Assessments (${oaDueApps.length + oaNeedsCheckApps.length})`} accent="indigo">
          {oaDueApps.map(a => (
            <OaRow key={a.id} app={a} onRefresh={onRefresh} />
          ))}
          {oaNeedsCheckApps.map(a => (
            <OaRow key={a.id} app={a} needsCheck onRefresh={onRefresh} />
          ))}
        </Section>
      )}

      {scheduleContacts.length > 0 && (
        <Section title={`Want to Schedule (${scheduleContacts.length})`} accent="indigo">
          {scheduleContacts.map(c => (
            <ScheduleQueueRow key={c.id} contact={c} onRefresh={onRefresh} />
          ))}
        </Section>
      )}

      {overdueContacts.length > 0 && (
        <Section title={`Overdue Follow-Ups (${overdueContacts.length})`} accent="red">
          {overdueContacts.map(c => (
            <OverdueContactRow key={c.id} contact={c} interactions={interactions} onRefresh={onRefresh} />
          ))}
        </Section>
      )}

      {staleApps.length > 0 && (
        <Section title={`Stale Applications (${staleApps.length})`} accent="orange"
          subtitle="No movement in 14+ days — follow up or update the stage.">
          {staleApps.map(a => (
            <ActionRow key={a.id}
              primary={a.company}
              secondary={a.role || ''}
              link={a.jdLink ? { href: a.jdLink, label: 'View JD ↗' } : null}
              badge={<Badge label={a.stage} color={STAGE_COLOR[a.stage]} />}
              meta={`${a.daysInStage ?? daysSince(a.lastActivity)}d in ${a.stage}`}
              metaColor="text-orange-600"
            />
          ))}
        </Section>
      )}

      {highUrgencyContacts.length > 0 && (
        <Section title={`High Urgency Contacts (${highUrgencyContacts.length})`} accent="yellow">
          {highUrgencyContacts.map(c => (
            <ActionRow key={c.id}
              primary={c.name}
              secondary={[c.company, c.role].filter(Boolean).join(' · ')}
              link={c.email ? { href: `mailto:${c.email}`, label: c.email } : null}
              badge={<Badge label="HIGH" color={URGENCY_COLOR.HIGH} />}
              meta={c.followUpDate ? `Due ${fmt(c.followUpDate)}` : 'No follow-up date set'}
              metaColor="text-ink-500"
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function Section({ title, subtitle, accent, children }) {
  const border = { red: 'border-danger-200', orange: 'border-orange-200', yellow: 'border-warning-200', indigo: 'border-indigo-200' }[accent] || 'border-ink-200'
  const heading = { red: 'text-danger-700', orange: 'text-orange-700', yellow: 'text-warning-700', indigo: 'text-indigo-700' }[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1`}>{title}</h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}

// A contact whose Follow-Up Date already passed, but who has a logged interaction newer
// than that date — the date's just stale, not actually overdue. Drafting an escalating
// follow-up here would nag someone already re-engaged; surface a "bump the date" hint
// instead of the draft flow.
function hasNewerInteraction(contact, interactions) {
  return interactions.some(i => i.contactId === contact.id && i.date && contact.followUpDate && new Date(i.date) > new Date(contact.followUpDate))
}

function OverdueContactRow({ contact: c, interactions, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const alreadyTouched = hasNewerInteraction(c, interactions)

  async function markFollowedUp() {
    setMarking(true)
    try {
      const nextFollowUp = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
      await updateContact(c.id, { followUpDate: nextFollowUp, lastInteraction: new Date().toISOString().split('T')[0] })
      await addInteraction({ contactId: c.id, contactName: c.name, type: 'Other', direction: 'Outbound', summary: 'Followed up (marked via Actions)' })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">{c.email}</a>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge label={c.status} color={STATUS_COLOR[c.status]} />
          <p className="text-xs font-medium text-danger-600">Was due {fmt(c.followUpDate)} ({Math.abs(daysUntil(c.followUpDate))}d ago)</p>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-accent-500 hover:underline">
              {expanded ? 'Hide' : alreadyTouched ? 'Details' : 'Draft follow-up'}
            </button>
            <button onClick={markFollowedUp} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {marking ? 'Marking...' : 'Mark followed up'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        alreadyTouched
          ? (
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mt-2 text-xs text-warning-800">
              A newer interaction is already logged for this contact — the Follow-Up Date field is just stale. Open the contact and update it, or use "Mark followed up" above.
            </div>
          )
          : <DraftPanel contact={c} kind="follow_up" daysOverdue={Math.abs(daysUntil(c.followUpDate))} onSaved={onRefresh} />
      )}
    </div>
  )
}

// Someone added via "+ Schedule" — reminder stays until explicitly marked scheduled
// (unchecking Wants To Schedule), independent of Follow-Up Date/Status, since this is
// "get something on the calendar" intent, not a post-interaction follow-up.
function ScheduleQueueRow({ contact: c, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [marking, setMarking] = useState(false)
  const overdue = c.scheduleBy && daysUntil(c.scheduleBy) <= 0

  async function markScheduled() {
    setMarking(true)
    try {
      await updateContact(c.id, { wantsToSchedule: false })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.scheduleNote && <p className="text-xs text-ink-400 italic mt-0.5 line-clamp-1">"{c.scheduleNote}"</p>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          {c.scheduleBy && (
            <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
              {overdue ? `Wanted by ${fmt(c.scheduleBy)} (${Math.abs(daysUntil(c.scheduleBy))}d ago)` : `Schedule by ${fmt(c.scheduleBy)}`}
            </p>
          )}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-accent-500 hover:underline">
              {expanded ? 'Hide' : 'Draft outreach'}
            </button>
            <button onClick={markScheduled} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {marking ? 'Marking...' : '✓ Scheduled'}
            </button>
          </div>
        </div>
      </div>

      {expanded && <DraftPanel contact={c} kind="cold_open" onSaved={onRefresh} />}
    </div>
  )
}

// A tracked Online Assessment — either has a known due date (from the email or the
// oaResearch.js cloud-agent fallback) or, when `needsCheck` is set, the fallback already ran and
// found no stated deadline on the page, so it's surfaced as a plain to-do: go check it yourself.
function OaRow({ app: a, needsCheck, onRefresh }) {
  const [marking, setMarking] = useState(false)
  const overdue = !needsCheck && daysUntil(a.oaDueDate) <= 0

  async function markCompleted() {
    setMarking(true)
    try {
      await updateApplication(a.id, { oaCompleted: true })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-900">{a.company}</p>
          <p className="text-xs text-ink-500">{a.role || ''}</p>
          {a.oaLink && (
            <a href={a.oaLink} target="_blank" rel="noreferrer" className="text-xs text-accent-500 hover:underline">
              Open assessment ↗
            </a>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          {needsCheck
            ? <p className="text-xs font-medium text-ink-400">No stated deadline found — check manually</p>
            : (
              <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
                {overdue ? `Was due ${fmt(a.oaDueDate)} (${Math.abs(daysUntil(a.oaDueDate))}d ago)` : `Due ${fmt(a.oaDueDate)} (${daysUntil(a.oaDueDate)}d)`}
              </p>
            )}
          <button onClick={markCompleted} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
            {marking ? 'Marking...' : '✓ Mark completed'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ActionRow({ primary, secondary, link, badge, meta, metaColor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div>
        <p className="text-sm font-medium text-ink-900">{primary}</p>
        {secondary && <p className="text-xs text-ink-500">{secondary}</p>}
        {link && <a href={link.href} target={link.href.startsWith('mailto') ? undefined : '_blank'} rel="noreferrer" className="text-xs text-accent-500 hover:underline">{link.label}</a>}
      </div>
      <div className="text-right shrink-0 space-y-1">
        {badge}
        <p className={`text-xs font-medium ${metaColor}`}>{meta}</p>
      </div>
    </div>
  )
}
