import { useState } from 'react'
import { m } from 'motion/react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, TYPE_COLOR, fmt, daysUntil, daysSince, Badge, EmptyState } from '../shared.jsx'
import { updateContact, addInteraction, updateApplicationTriage, archiveApplication, updateApplication, completeActionItem, dismissActionItem, dismissActionItems } from '../db.js'
import { logMetWithContact } from '../lib/quickLog.js'
import { overdueFollowUps, staleApplications, highUrgencyContacts, wantToSchedule, oaDue, oaNeedsCheck, needsReviewApps, keepInTouchDue, awaitingReply, openActionItems, trimActionItems, dedupeAcross } from '../lib/attention.js'
import useTodayPrefs from '../lib/useTodayPrefs.js'
import { lastPointOfContact } from '../lib/keepInTouch.js'
import { tieStrengthBucket } from '../lib/affinity.js'
import { statusIconFor } from '../lib/icons.js'
import { BUCKET_CONFIG, BUCKET_TAG, BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import DraftPanel from './DraftPanel.jsx'
import TextDraftPanel from './TextDraftPanel.jsx'
import SidePanel from './ui/SidePanel.jsx'
import ContactPanelBody from './panels/ContactPanelBody.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import LogInteractionModal from './LogInteractionModal.jsx'
import MetButton from './MetButton.jsx'
import Mono from './ui/Mono.jsx'
import { SectionAction, RowCap } from './ui/Section.jsx'
import { HeartHandshake, ClipboardCheck, Clock, MessageSquarePlus, ListTodo } from 'lucide-react'
import { DashCard, Group, Label } from './today/DashCard.jsx'
import { PipelineCard, NetworkCard, OutreachCard } from './today/MetricCards.jsx'
import GettingStarted from './onboarding/GettingStarted.jsx'
import { isFreshAccount } from '../lib/onboarding.js'
import { addDaysLocal, todayLocal } from '../lib/dates.js'
import { deriveEventAttention, EventsCard } from './today/EventAttentionSections.jsx'

// Hover/cursor for any row region that opens a panel — every clickable thing on Today
// answers the mouse, and nothing else does (docs/architecture/design-system.md, Affordances).
const ROW_HIT = 'cursor-pointer rounded-sm -mx-1.5 px-1.5 hover:bg-ink-50 transition-colors'

// Originally from the retired KeepInTouchTab.jsx; Today is its only home now.
const TIE_LABEL = { strong: 'Close tie', moderate: 'Moderate tie', weak: 'Weak tie', cold: 'Not yet connected' }

// Mount-time stagger across the dashboard's cards — same shape as NotFoundPage.jsx's
// container/rise precedent, tightened so seven-ish cards land in well under a second.
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }
const rise = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// A contact whose Follow-Up Date already passed, but who has a logged interaction newer
// than that date — the date's just stale, not actually overdue. Ported verbatim from the
// former Actions tab.
function hasNewerInteraction(contact, interactions) {
  return interactions.some(i => i.contactId === contact.id && i.date && contact.followUpDate && new Date(i.date) > new Date(contact.followUpDate))
}

function OverdueRow({ contact: c, interactions, onRefresh, onOpen }) {
  const [panel, setPanel] = useState(null) // null | 'draft' | 'text'
  const [marking, setMarking] = useState(false)
  const alreadyTouched = hasNewerInteraction(c, interactions)

  async function markFollowedUp() {
    setMarking(true)
    try {
      const nextFollowUp = addDaysLocal(7)
      await updateContact(c.id, { followUpDate: nextFollowUp, lastInteraction: todayLocal() })
      await addInteraction({ contactId: c.id, contactName: c.name, type: 'Other', direction: 'Outbound', summary: 'Followed up (marked via Actions)' })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="block truncate text-xs text-link hover:underline">{c.email}</a>}
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          <Badge label={c.status} color={STATUS_COLOR[c.status]} />
          <p className="text-xs font-medium text-danger-600">
            Was due <Mono>{fmt(c.followUpDate)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(c.followUpDate))}d</Mono> ago)
          </p>
          <div className="flex items-center gap-2 sm:justify-end">
            <button onClick={() => setPanel(p => p === 'draft' ? null : 'draft')} className="text-xs text-link hover:underline">
              {panel === 'draft' ? 'Hide' : alreadyTouched ? 'Details' : 'Draft follow-up'}
            </button>
            {c.phone && (
              <button onClick={() => setPanel(p => p === 'text' ? null : 'text')} className="text-xs text-link hover:underline">
                {panel === 'text' ? 'Hide' : 'Text'}
              </button>
            )}
            <button onClick={markFollowedUp} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {marking ? 'Marking...' : 'Mark followed up'}
            </button>
          </div>
        </div>
      </div>

      {panel === 'draft' && (
        alreadyTouched
          ? (
            <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 mt-2 text-xs text-warning-800">
              A newer interaction is already logged for this contact — the Follow-Up Date field is just stale. Open the contact and update it, or use "Mark followed up" above.
            </div>
          )
          : <DraftPanel contact={c} kind="follow_up" daysOverdue={Math.abs(daysUntil(c.followUpDate))} onSaved={onRefresh} />
      )}
      {panel === 'text' && <TextDraftPanel contact={c} daysOverdue={Math.abs(daysUntil(c.followUpDate))} />}
    </div>
  )
}

// A contact whose last logged touchpoint was something the user sent (Email/LinkedIn) with
// nothing back for `thresholdDays`+ — see lib/attention.js's awaitingReply() for the exact
// inference. Two ways off this list: log the reply that actually came in, or send a nudge
// (which just resets the clock, same as a fresh Outbound interaction would).
function AwaitingReplyRow({ item, onRefresh, onOpen }) {
  const { contact: c, lastInteraction, daysWaiting } = item
  const [panel, setPanel] = useState(null) // null | 'draft' | 'text'
  const [busy, setBusy] = useState(false)

  async function logReply() {
    setBusy(true)
    try {
      await addInteraction({ contactId: c.id, contactName: c.name, type: lastInteraction.type, direction: 'Inbound', summary: 'They replied (logged via Today)' })
      onRefresh?.()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          <Badge label={lastInteraction.type} color={TYPE_COLOR[lastInteraction.type] || TYPE_COLOR.Other} />
          <p className="text-xs font-medium text-warning-700">
            No reply in <Mono className="text-warning-700 font-medium">{daysWaiting}d</Mono>
          </p>
          <div className="flex items-center gap-2 sm:justify-end">
            <button onClick={() => setPanel(p => p === 'draft' ? null : 'draft')} className="text-xs text-link hover:underline">
              {panel === 'draft' ? 'Hide' : 'Draft nudge'}
            </button>
            {c.phone && (
              <button onClick={() => setPanel(p => p === 'text' ? null : 'text')} className="text-xs text-link hover:underline">
                {panel === 'text' ? 'Hide' : 'Text'}
              </button>
            )}
            <button onClick={logReply} disabled={busy} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {busy ? 'Marking...' : 'They replied'}
            </button>
          </div>
        </div>
      </div>
      {panel === 'draft' && <DraftPanel contact={c} kind="follow_up" daysOverdue={daysWaiting} onSaved={onRefresh} />}
      {panel === 'text' && <TextDraftPanel contact={c} daysOverdue={daysWaiting} />}
    </div>
  )
}

// Someone added via "+ Schedule" — reminder stays until explicitly marked scheduled
// (unchecking Wants To Schedule), independent of Follow-Up Date/Status, since this is
// "get something on the calendar" intent, not a post-interaction follow-up.
function ScheduleRow({ contact: c, onRefresh, onOpen }) {
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
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.scheduleNote && <p className="text-xs text-ink-400 italic mt-0.5 line-clamp-1">"{c.scheduleNote}"</p>}
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          {c.scheduleBy && (
            <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
              {overdue
                ? <>Wanted by <Mono>{fmt(c.scheduleBy)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(c.scheduleBy))}d</Mono> ago)</>
                : <>Schedule by <Mono>{fmt(c.scheduleBy)}</Mono></>}
            </p>
          )}
          <div className="flex items-center gap-2 sm:justify-end">
            <button onClick={() => setExpanded(e => !e)} className="text-xs text-link hover:underline">
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

// High-urgency contacts had no click/expand behavior at all in the former Actions tab
// (rendered via the fully inert generic ActionRow) — this is a new dedicated row, not a port, but per D-05
// no new action *types* are introduced: it only gains the row-click-to-modal wiring every
// other row type gets in this phase.
function HighUrgencyRow({ contact: c, onOpen }) {
  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="block truncate text-xs text-link hover:underline">{c.email}</a>}
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          <Badge label="HIGH" color={URGENCY_COLOR.HIGH} />
          <p className="text-xs font-medium text-ink-500">
            {c.followUpDate ? <>Due <Mono>{fmt(c.followUpDate)}</Mono></> : 'No follow-up date set'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Ported from the retired KeepInTouchTab.jsx, remapped onto onOpen/onLog/onMet. `status` is the
// per-contact { cadence, dueDate, overdueDays, never } object keepInTouchDue's queue items
// carry alongside `contact` — required for the cadence/overdue text below, so it's threaded
// in as its own prop rather than recomputed here.
function KeepInTouchRow({ contact: c, status, interactions, onOpen, onLog, onMet }) {
  const last = lastPointOfContact(c, interactions)
  const bucket = tieStrengthBucket(c, interactions)
  const overdue = !status.never && status.overdueDays > 0
  // A plain divided row now that it sits in the People card, like every other row there.
  return (
    <div className="py-2.5 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => onOpen(c)}>
        <p className="text-sm font-medium text-ink-900">{c.name}</p>
        <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
        <p className="mt-0.5 flex items-center gap-1 flex-wrap text-[11px] text-ink-400">
          <Clock size={11} /> {TIE_LABEL[bucket]} · every <Mono>{status.cadence}</Mono>d
          {last && <> · last {last.type} <Mono>{fmt(last.date)}</Mono></>}
        </p>
      </div>
      <div className="sm:text-right sm:shrink-0 space-y-1">
        <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
        <p className={`text-xs font-medium ${overdue ? 'text-warning-700' : 'text-ink-500'}`}>
          {status.never ? 'Never contacted' : overdue ? <><Mono className="font-medium">{status.overdueDays}d</Mono> overdue</> : 'Due today'}
        </p>
        <div className="flex items-center gap-1.5 sm:justify-end">
          <MetButton contact={c} onMet={onMet} />
          <button onClick={() => onLog(c)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-600 text-on-accent rounded-full text-xs font-medium hover:bg-accent-700">
            <MessageSquarePlus size={12} /> Log
          </button>
        </div>
      </div>
    </div>
  )
}

// Application-shaped row used by Stale Applications and Job Boards Needs-Review (UI-SPEC
// Type 3). Visual shape ported from the former Actions tab's inert ActionRow, wired with
// ApplicationsView.jsx's row-click-opens-modal mechanic. `changeAppTriage` is the shared
// mutation defined inside TodayTab (below) — threaded in as a prop since this is a
// standalone component, not nested inside TodayTab's closure.
function ApplicationRow({ app: a, showTriageChips, onOpen, changeAppTriage }) {
  return (
    <div className={`flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 py-2.5 ${ROW_HIT}`} onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500">{a.role || ''}</p>
        {a.jdLink && (
          <a href={a.jdLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs text-link hover:underline">View JD ↗</a>
        )}
      </div>
      <div className="sm:text-right sm:shrink-0 space-y-1">
        <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
        <p className="text-xs font-medium text-ink-500">
          <Mono>{a.daysInStage ?? daysSince(a.lastActivity)}d</Mono> in {a.stage}
        </p>
        {showTriageChips && (
          <div className="flex flex-wrap gap-1 sm:justify-end">
            {BUCKET_CONFIG.filter(b => !['all', 'review'].includes(b.key)).map(b => (
              <button key={b.key}
                onClick={e => { e.stopPropagation(); changeAppTriage(a, b.key) }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${BUCKET_TAG[b.key]}`}>
                {b.icon} {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// A tracked Online Assessment (UI-SPEC Type 4) — either has a known due date, or, when
// `needsCheck` is set, no stated deadline was found on the page (go check manually). Ported
// from the former Actions tab, with the same row-click-to-modal wiring as ApplicationRow and
// stopPropagation added to the two nested interactive elements (open-assessment link,
// mark-completed button), neither of which stopped propagation before this phase since the
// row itself wasn't clickable yet.
function OaRow({ app: a, needsCheck, onOpen, onRefresh, onLogOa }) {
  const [marking, setMarking] = useState(false)
  const overdue = !needsCheck && daysUntil(a.oaDueDate) <= 0

  // withLog: also open Learn's log modal pre-filled as an assessment for this application —
  // the only way CodeSignal/HackerRank results reach the Learn tab (no public score APIs).
  async function markCompleted(withLog = false) {
    setMarking(true)
    try {
      await updateApplication(a.id, { oaCompleted: true })
      if (withLog) onLogOa?.(a)
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className={`flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 py-2.5 ${ROW_HIT}`} onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500">{a.role || ''}</p>
        {a.oaLink && (
          <a href={a.oaLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs text-link hover:underline">
            Open assessment ↗
          </a>
        )}
      </div>
      <div className="sm:text-right sm:shrink-0 space-y-1">
        {needsCheck
          ? <p className="text-xs font-medium text-ink-400">No stated deadline found — check manually</p>
          : (
            <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
              {overdue
                ? <>Was due <Mono>{fmt(a.oaDueDate)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(a.oaDueDate))}d</Mono> ago)</>
                : <>Due <Mono>{fmt(a.oaDueDate)}</Mono> (<Mono>{daysUntil(a.oaDueDate)}d</Mono>)</>}
            </p>
          )}
        <button onClick={e => { e.stopPropagation(); markCompleted() }} disabled={marking}
          className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
          {marking ? 'Marking...' : '✓ Mark completed'}
        </button>
        {onLogOa && !marking && (
          <button onClick={e => { e.stopPropagation(); markCompleted(true) }}
            className="block ml-auto text-xs text-accent-700 hover:underline">
            Done — log how it went →
          </button>
        )}
      </div>
    </div>
  )
}

// An AI-flagged action item from the email pipeline's classification pass (see
// lib/attention.js's openActionItems()) — distinct from every other row type in this file
// in that Claude authored the summary text directly at classification time, rather than it
// being inferred after the fact from a stale date. Two ways off the list: mark it done, or
// dismiss it as not actually actionable.
function ActionItemRow({ item, contacts, onRefresh, onOpen }) {
  const [busy, setBusy] = useState(false)
  const contact = item.contactId ? contacts.find(c => c.id === item.contactId) : null
  const priorityColor = { high: URGENCY_COLOR.HIGH, medium: URGENCY_COLOR.MED, low: URGENCY_COLOR.LOW }[item.priority] || URGENCY_COLOR.MED

  async function act(fn) {
    setBusy(true)
    try {
      await fn(item.id)
      onRefresh?.()
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${contact ? ROW_HIT : ''}`} onClick={contact ? () => onOpen(contact) : undefined}>
          <p className="text-sm font-medium text-ink-900">{item.summary}</p>
          {contact && <p className="text-xs text-ink-500">{[contact.name, contact.company].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          <Badge label={item.priority.toUpperCase()} color={priorityColor} />
          {item.dueDate && (
            <p className={`text-xs font-medium ${daysUntil(item.dueDate) <= 0 ? 'text-danger-600' : 'text-ink-500'}`}>
              Due <Mono>{fmt(item.dueDate)}</Mono>
            </p>
          )}
          <div className="flex items-center gap-2 sm:justify-end">
            <button onClick={() => act(completeActionItem)} disabled={busy} className="text-xs text-link hover:underline disabled:opacity-40">
              {busy ? '...' : '✓ Done'}
            </button>
            <button onClick={() => act(dismissActionItem)} disabled={busy} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TodayTab({ contacts, apps, interactions = [], relationships = [], actionItems = [], onLogOa, onFindPeople, onRefresh, onRefreshRelationships, eventPool = null, onOpenEvents, isDemoMode = false }) {
  const prefs = useTodayPrefs()
  // Declutter pass 1: AI action items that already resolved themselves (replied on the
  // thread, long expired, duplicates) never reach the list.
  const trimmed = trimActionItems(openActionItems(actionItems), interactions)
  // Pass 2: a contact shows up in one people group only, highest-priority first.
  const people = dedupeAcross({
    overdue: overdueFollowUps(contacts),
    awaiting: awaitingReply(contacts, interactions),
    schedule: wantToSchedule(contacts),
    urgent: highUrgencyContacts(contacts),
    keepInTouch: keepInTouchDue(contacts, interactions),
  })
  // Pass 3: rows the user hid (✕ / Clear all) stay hidden for a week.
  const SNOOZE_KEY = { overdue: c => c.id, awaiting: x => x.contact.id, schedule: c => c.id, urgent: c => c.id, keepInTouch: x => x.contact.id, stale: a => a.id, review: a => a.id, oa: a => a.id, oaCheck: a => a.id }
  let snoozedHidden = 0
  const visible = (id, rows) => {
    const out = rows.filter(r => !prefs.isSnoozed(`${id}:${SNOOZE_KEY[id](r)}`))
    snoozedHidden += rows.length - out.length
    return out
  }
  const openItems = trimmed.items
  const peopleGroups = {
    overdue: visible('overdue', people.overdue),
    awaiting: visible('awaiting', people.awaiting),
    urgent: visible('urgent', people.urgent),
    schedule: visible('schedule', people.schedule),
    keepInTouch: visible('keepInTouch', people.keepInTouch),
  }
  const appGroups = {
    oa: visible('oa', oaDue(apps)),
    stale: visible('stale', staleApplications(apps)),
    review: visible('review', needsReviewApps(apps)),
    oaCheck: visible('oaCheck', oaNeedsCheck(apps)),
  }
  // Recruiting events (v1.1): empty when there's no pool or no campus picked yet.
  const eventAttention = deriveEventAttention(eventPool)

  const [selectedContactId, setSelectedContactId] = useState(null)
  const [selectedAppId, setSelectedAppId] = useState(null)
  const [logContact, setLogContact] = useState(null)
  const [dismissingAll, setDismissingAll] = useState(false)

  async function handleMet(contact) {
    await logMetWithContact(contact)
    onRefresh?.()
  }

  // Shared triage mutation — used both by Job Boards Needs-Review's inline chips (via
  // ApplicationRow) and by the application panel's onStatusChange below. Matches
  // ApplicationsView.jsx's changeTriage exactly.
  async function changeAppTriage(app, bucketKey) {
    await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
    onRefresh?.()
  }

  async function dismissAllItems() {
    if (!window.confirm(`Dismiss all ${openItems.length} action items? They won't come back.`)) return
    setDismissingAll(true)
    try { await dismissActionItems(openItems.map(i => i.id)); onRefresh?.() }
    finally { setDismissingAll(false) }
  }

  const selectedApp = selectedAppId ? apps.find(a => a.id === selectedAppId) : null
  const openContact = x => setSelectedContactId(x.id)
  const openApp = x => setSelectedAppId(x.id)

  const total = groups => Object.values(groups).reduce((n, rows) => n + rows.length, 0)
  const peopleCount = total(peopleGroups)
  const appCount = total(appGroups)
  const openCount = openItems.length + peopleCount + appCount + eventAttention.count
  const allEmpty = openCount === 0
  const hasData = apps.length > 0 || contacts.length > 0 || interactions.length > 0

  // Per-row ✕ snoozes one row; a card's "Clear all" snoozes every row in it.
  const hide = id => x => prefs.snooze([`${id}:${SNOOZE_KEY[id](x)}`])
  const clearAll = groups => (
    <SectionAction onClick={() => prefs.snooze(Object.entries(groups).flatMap(([id, rows]) => rows.map(x => `${id}:${SNOOZE_KEY[id](x)}`)))}>
      Clear all
    </SectionAction>
  )

  const cards = {
    email: openItems.length > 0 && (
      <DashCard label="From your email" tone="warning" icon={ListTodo} count={openItems.length}
        actions={<SectionAction onClick={dismissAllItems} disabled={dismissingAll}>{dismissingAll ? 'Clearing…' : 'Dismiss all'}</SectionAction>}>
        <div className="mt-1">
          <RowCap items={openItems} tier="warning"
            renderItem={item => <ActionItemRow key={item.id} item={item} contacts={contacts} onRefresh={onRefresh} onOpen={openContact} />} />
        </div>
      </DashCard>
    ),
    people: peopleCount > 0 && (
      <DashCard label="People" tone={peopleGroups.overdue.length || peopleGroups.urgent.length ? 'danger' : 'warning'} icon={HeartHandshake}
        count={peopleCount} actions={clearAll(peopleGroups)}>
        <Group label="Overdue follow-up" tone="danger" items={peopleGroups.overdue} onHide={hide('overdue')}
          renderItem={c => <OverdueRow key={c.id} contact={c} interactions={interactions} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="Awaiting reply" tone="warning" items={peopleGroups.awaiting} onHide={hide('awaiting')}
          renderItem={item => <AwaitingReplyRow key={item.contact.id} item={item} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="High urgency" tone="danger" items={peopleGroups.urgent} onHide={hide('urgent')}
          renderItem={c => <HighUrgencyRow key={c.id} contact={c} onOpen={openContact} />} />
        <Group label="Want to schedule" tone="ink" items={peopleGroups.schedule} onHide={hide('schedule')}
          renderItem={c => <ScheduleRow key={c.id} contact={c} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="Keep in touch" tone="warning" items={peopleGroups.keepInTouch} onHide={hide('keepInTouch')}
          renderItem={({ contact: c, status }) => (
            <KeepInTouchRow key={c.id} contact={c} status={status} interactions={interactions}
              onOpen={openContact} onLog={setLogContact} onMet={handleMet} />
          )} />
      </DashCard>
    ),
    apps: appCount > 0 && (
      <DashCard label="Applications" tone={appGroups.stale.length ? 'danger' : 'warning'} icon={ClipboardCheck}
        count={appCount} actions={clearAll(appGroups)}>
        <Group label="OA due" tone="warning" items={appGroups.oa} onHide={hide('oa')}
          renderItem={a => <OaRow key={a.id} app={a} onOpen={openApp} onRefresh={onRefresh} onLogOa={onLogOa} />} />
        <Group label="Stale · no movement 14d+" tone="danger" items={appGroups.stale} onHide={hide('stale')}
          renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips={false} onOpen={openApp} changeAppTriage={changeAppTriage} />} />
        <Group label="Job boards to review" tone="warning" items={appGroups.review} onHide={hide('review')}
          renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips onOpen={openApp} changeAppTriage={changeAppTriage} />} />
        <Group label="OA deadline unknown" tone="ink" items={appGroups.oaCheck} onHide={hide('oaCheck')}
          renderItem={a => <OaRow key={a.id} app={a} needsCheck onOpen={openApp} onRefresh={onRefresh} onLogOa={onLogOa} />} />
      </DashCard>
    ),
    events: (eventAttention.count > 0 || eventAttention.degraded.length > 0) && (
      <EventsCard attention={eventAttention} pool={eventPool} onOpenEvents={onOpenEvents} />
    ),
  }
  // Two stacks, balanced by roughly how many rows each card shows (RowCap shows 3 per group),
  // so one column doesn't run a screen longer than the other. Order is kept within a stack;
  // a lone card takes the full width.
  const shown = groups => Object.values(groups).reduce((n, rows) => n + (rows.length ? Math.min(rows.length, 3) + 0.5 : 0), 1)
  const weighted = [
    [cards.email, shown({ items: openItems })],
    [cards.people, shown(peopleGroups)],
    [cards.apps, shown(appGroups)],
    [cards.events, shown({ s: eventAttention.steps, r: eventAttention.registrations, f: eventAttention.followUps }) + (eventAttention.degraded.length ? 1 : 0)],
  ].filter(([card]) => card)
  const stacks = [[], []]
  const heights = [0, 0]
  for (const [card, w] of weighted) {
    const i = heights[0] <= heights[1] ? 0 : 1
    stacks[i].push(card); heights[i] += w
  }
  if (!stacks[1].length) stacks.pop()

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <m.div className="space-y-3" variants={container} initial="hidden" animate="show">
      <m.div variants={rise} className="flex items-center gap-4 flex-wrap px-1">
        <Label tone={allEmpty ? 'success' : 'accent'}>
          {today} <span className="text-ink-300">/</span> {allEmpty ? 'all clear' : `${openCount} open`}
        </Label>
        <span className="ml-auto flex items-center gap-4 text-xs text-ink-400">
          {trimmed.hidden > 0 && <span title="Already replied on the thread, long past due, or duplicates">{trimmed.hidden} resolved AI items auto-hidden</span>}
          {snoozedHidden > 0 && (
            <button onClick={prefs.clearSnoozes} className="hover:text-ink-700 hover:underline">Unhide {snoozedHidden}</button>
          )}
        </span>
      </m.div>

      {allEmpty && !isDemoMode && isFreshAccount({ contacts, apps })
        ? <GettingStarted hasApps={apps.length > 0} hasContacts={contacts.length > 0} apps={apps} contacts={contacts} />
        : <>
          {hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <m.div variants={rise}><PipelineCard apps={apps} /></m.div>
              <m.div variants={rise}><NetworkCard contacts={contacts} /></m.div>
              <m.div variants={rise} className="md:col-span-2 xl:col-span-1"><OutreachCard interactions={interactions} /></m.div>            </div>
          )}
          {allEmpty
            ? <m.div variants={rise}><EmptyState msg={snoozedHidden ? `✓ Nothing left — ${snoozedHidden} hidden for now.` : "✓ Nothing needs your attention. You're on top of it."} /></m.div>
            : (
              <div className={`grid grid-cols-1 gap-3 items-start ${stacks.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                {stacks.map((stack, i) => (
                  <div key={i} className="space-y-3 min-w-0">
                    {stack.map((card, j) => <m.div key={j} variants={rise}>{card}</m.div>)}
                  </div>
                ))}
              </div>
            )}
        </>}

      <SidePanel open={!!selectedContactId} onClose={() => setSelectedContactId(null)}>
        {selectedContactId && (
          <ContactPanelBody
            contact={contacts.find(c => c.id === selectedContactId)}
            contacts={contacts}
            interactions={interactions}
            contactRelationships={relationships}
            onClose={() => setSelectedContactId(null)}
            onSaved={() => { setSelectedContactId(null); onRefresh?.() }}
            onRefreshRelationships={onRefreshRelationships}
          />
        )}
      </SidePanel>
      {logContact && (
        <LogInteractionModal
          contacts={contacts}
          contact={logContact}
          onClose={() => setLogContact(null)}
          onSaved={() => { setLogContact(null); onRefresh?.() }}
        />
      )}
      <SidePanel open={!!selectedAppId} onClose={() => setSelectedAppId(null)}>
        {selectedAppId && (
          <ApplicationPanelBody
            app={selectedApp}
            contacts={contacts}
            apps={apps}
            interactions={interactions}
            relationships={relationships}
            onStatusChange={s => changeAppTriage(selectedApp, s)}
            onClose={() => setSelectedAppId(null)}
            onDelete={async () => { await archiveApplication(selectedApp.id); setSelectedAppId(null); onRefresh?.() }}
            onSaved={() => onRefresh?.()}
            onFindPeople={onFindPeople}
            onRefresh={onRefresh}
            onRefreshRelationships={onRefreshRelationships}
          />
        )}
      </SidePanel>
    </m.div>
  )
}
