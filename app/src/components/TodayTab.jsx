import { lazy, Suspense, useMemo, useState } from 'react'
import { m } from 'motion/react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, TYPE_COLOR, fmt, daysUntil, daysSince, Badge, EmptyState } from '../shared.jsx'
import { updateContact, addInteraction, updateApplicationTriage, archiveApplication, updateApplication, completeActionItem, dismissActionItem, dismissActionItems } from '../db.js'
import { logMetWithContact } from '../lib/quickLog.js'
import { staleApplications, oaDue, oaNeedsCheck, needsReviewApps, openActionItems, trimActionItems, todayPeople, pipelineRates, offerDecisions, upcomingInterviews, PEOPLE_GROUPS } from '../lib/attention.js'
import useTodayPrefs from '../lib/useTodayPrefs.js'
import useTodayLayout from '../lib/useTodayLayout.js'
import { enabledGroups, settingValue, layoutBands, layoutContext } from '../lib/todayCards.js'
import { lastPointOfContact } from '../lib/keepInTouch.js'
import { tieStrengthBucket } from '../lib/affinity.js'
import { statusIconFor } from '../lib/icons.js'
import { BUCKET_CONFIG, BUCKET_TAG, BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import DraftPanel from './DraftPanel.jsx'
import ThankYouDraft from './today/ThankYouDraft.jsx'
import TextDraftPanel from './TextDraftPanel.jsx'
import SidePanel from './ui/SidePanel.jsx'
import ContactPanelBody from './panels/ContactPanelBody.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import LogInteractionModal from './LogInteractionModal.jsx'
import MetButton from './MetButton.jsx'
import Mono from './ui/Mono.jsx'
import { SectionAction, RowCap } from './ui/Section.jsx'
import { HeartHandshake, ClipboardCheck, Clock, MessageSquarePlus, ListTodo, PenLine, SlidersHorizontal, Scale } from 'lucide-react'
import { draftPreview, DRAFT_INTENT_LABEL } from '../lib/replyDrafts.js'
import { DashCard, Group, Label } from './today/DashCard.jsx'
import { PipelineCard, NetworkCard, OutreachCard, RatesCard } from './today/MetricCards.jsx'
import GettingStarted from './onboarding/GettingStarted.jsx'
import { isFreshAccount } from '../lib/onboarding.js'
import { addDaysLocal, todayLocal } from '../lib/dates.js'
import { deriveEventAttention, EventsCard } from './today/EventAttentionSections.jsx'

// Edit mode, with @dnd-kit, loads only when Customize is pressed (v1.4 spec 08).
const TodayEditor = lazy(() => import('./today/TodayEditor.jsx'))

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

// An interview or a call/meeting in the last two days with nothing written to them since
// (v1.4 spec 03, lib/attention.js thankYouDue). "Sent it" logs the email, which clears the
// row; with nobody on file at the company there's no one to log it against, so it hides it.
function ThankYouRow({ row, onRefresh, onOpenContact, onOpenApp, onHide }) {
  const [drafting, setDrafting] = useState(false)
  const [marking, setMarking] = useState(false)
  const { contact: c, app: a } = row
  const what = a ? `${a.stage || 'Interview'} · ${a.role || a.company}` : (row.interaction.summary || row.interaction.type)
  const when = a ? daysSince(a.interviewAt) : daysSince(row.interaction.date)

  async function sentIt() {
    if (!c) { onHide(row); return }
    setMarking(true)
    try {
      await addInteraction({ contactId: c.id, contactName: c.name, type: 'Email', direction: 'Outbound', summary: a ? `Thank-you after the ${a.company} interview` : 'Sent a thank-you' })
      onRefresh?.()
    } catch {
      setMarking(false)
    }
  }

  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className={`min-w-0 max-w-full ${ROW_HIT}`} onClick={() => (c ? onOpenContact(c) : onOpenApp(a))}>
          <p className="text-sm font-medium text-ink-900">{c ? c.name : a.company}</p>
          <p className="text-xs text-ink-500 truncate">{c ? [c.company, what].filter(Boolean).join(' · ') : what}</p>
        </div>
        <div className="sm:text-right sm:shrink-0 space-y-1">
          <p className="text-xs font-medium text-ink-500">
            {a ? 'Interviewed' : row.interaction.type === 'Call' ? 'Called' : 'Met'} <Mono>{when === 0 ? 'today' : when === 1 ? 'yesterday' : `${when}d ago`}</Mono>
          </p>
          <div className="flex items-center gap-2 sm:justify-end">
            <button onClick={() => setDrafting(d => !d)} className="text-xs text-link hover:underline">
              {drafting ? 'Hide' : 'Draft'}
            </button>
            <button onClick={sentIt} disabled={marking} className="text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40">
              {marking ? 'Logging…' : 'Sent it'}
            </button>
          </div>
        </div>
      </div>
      {drafting && <ThankYouDraft row={row} />}
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

// "in 3d" / "today" / "tomorrow", the countdown on interview and offer rows.
function countdown(days) {
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days < 0 ? `${-days}d ago` : `in ${days}d`
}

// An interview the scan (or the user) put a date on (v1.4 spec 02). A date-only interview
// shows no time: the scan stored it at noon as a placeholder.
function InterviewRow({ app: a, onOpen }) {
  const at = new Date(a.interviewAt)
  const when = at.toLocaleString('en-US', a.interviewTimeKnown
    ? { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric' })
  const days = daysUntil(a.interviewAt)
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${ROW_HIT}`} onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500 truncate">{[a.role, a.stage].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="text-right shrink-0">
        <Mono className={`block text-sm font-semibold ${days <= 1 ? 'text-warning-700' : 'text-ink-900'}`}>{countdown(days)}</Mono>
        <Mono className="block text-xs text-ink-500">{when}</Mono>
      </div>
    </div>
  )
}

// An offer waiting on an answer, with its deadline counting down. No deadline on file is
// its own prompt: most offer letters state one, and the panel is where it goes.
function DecisionRow({ app: a, onOpen }) {
  const days = a.offerDeadline ? daysUntil(a.offerDeadline) : null
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${ROW_HIT}`} onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500 truncate">{a.role || 'Offer'}</p>
      </div>
      {days === null
        ? <p className="text-xs text-ink-400 text-right shrink-0">No deadline on file · add one</p>
        : (
          <div className="text-right shrink-0">
            <Mono className={`block text-sm font-semibold ${days <= 3 ? 'text-danger-600' : 'text-ink-900'}`}>{days < 0 ? `${-days}d past` : countdown(days)}</Mono>
            <p className="text-xs text-ink-500">Decide by <Mono>{fmt(a.offerDeadline)}</Mono></p>
          </div>
        )}
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

// A reply the Gmail scan drafted (v1.4 spec 10). Opens the thread in Inbox, where it's edited
// and copied into Gmail; nothing is sent from Today.
function DraftRow({ draft, contacts, onOpen }) {
  const to = String(draft.toAddress || '').toLowerCase()
  const contact = to ? contacts.find(c => String(c.email || '').toLowerCase() === to) : null
  return (
    <div className={`py-2.5 flex items-start gap-3 ${ROW_HIT}`} onClick={() => onOpen(draft.threadId)}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900 truncate">
          {contact ? [contact.name, contact.company].filter(Boolean).join(' · ') : draft.toAddress}
          <span className="text-ink-400 font-normal"> · {draft.subject}</span>
        </p>
        <p className="text-xs text-ink-500 truncate">{draftPreview(draft.body)}</p>
      </div>
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-accent-700">{DRAFT_INTENT_LABEL[draft.intent] || 'Reply'}</span>
    </div>
  )
}

export default function TodayTab({ contacts, apps, interactions = [], relationships = [], actionItems = [], onLogOa, onFindPeople, onRefresh, onRefreshRelationships, eventPool = null, onOpenEvents, emailDrafts = [], onOpenDraft, profile = null, isDemoMode = false }) {
  const prefs = useTodayPrefs()
  // Which cards show, in what order and width, and which lists inside them (v1.4 spec 08).
  const school = eventPool?.school
  const ctx = useMemo(() => layoutContext(profile, school), [profile, school])
  const { layout, update, reset, customized } = useTodayLayout(ctx)
  const [editing, setEditing] = useState(false)
  const placed = Object.fromEntries(layout.cards.map(c => [c.id, c]))
  const groupsOn = id => (placed[id] ? enabledGroups(placed[id], ctx) : [])
  const capOf = id => placed[id]?.cap

  // Declutter pass 1: AI action items that already resolved themselves (replied on the
  // thread, long expired, duplicates) never reach the list.
  const trimmed = trimActionItems(openActionItems(actionItems), interactions)
  // Pass 2: a contact shows up in one people group only, the first one that's on.
  const peopleOn = groupsOn('people')
  const people = todayPeople(contacts, interactions, {
    off: PEOPLE_GROUPS.filter(g => !peopleOn.includes(g)),
    awaitingDays: placed.people ? settingValue(placed.people, 'awaitingDays') : undefined,
    apps,
  })
  // Pass 3: rows the user hid (✕ / Clear all) stay hidden for a week.
  const SNOOZE_KEY = { thankYou: x => x.id, overdue: c => c.id, awaiting: x => x.contact.id, schedule: c => c.id, urgent: c => c.id, keepInTouch: x => x.contact.id, stale: a => a.id, review: a => a.id, oa: a => a.id, oaCheck: a => a.id, replies: d => d.id, interview: a => a.id, decisions: a => a.id }
  let snoozedHidden = 0
  const visible = (id, rows) => {
    const out = rows.filter(r => !prefs.isSnoozed(`${id}:${SNOOZE_KEY[id](r)}`))
    snoozedHidden += rows.length - out.length
    return out
  }
  const openItems = placed.email ? trimmed.items : []
  const replyDrafts = placed.replies ? visible('replies', emailDrafts) : []
  const peopleGroups = Object.fromEntries(PEOPLE_GROUPS.map(id => [id, visible(id, people[id])]))
  const appsOn = groupsOn('apps')
  const staleDays = placed.apps ? settingValue(placed.apps, 'staleDays') : 14
  const decisions = placed.decisions ? visible('decisions', offerDecisions(apps)) : []
  const appRows = {
    interview: () => upcomingInterviews(apps),
    oa: () => oaDue(apps),
    stale: () => staleApplications(apps, { days: staleDays }),
    review: () => needsReviewApps(apps),
    oaCheck: () => oaNeedsCheck(apps),
  }
  const appGroups = Object.fromEntries(Object.entries(appRows).map(([id, rows]) => [id, appsOn.includes(id) ? visible(id, rows()) : []]))
  // Recruiting events (v1.1): empty when there's no pool or no campus picked yet.
  const eventAttention = deriveEventAttention(placed.events ? eventPool : null)

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
  // Counts cover the cards and lists that are on, so a hidden list never inflates the header.
  const counts = { decisions: decisions.length, replies: replyDrafts.length, email: openItems.length, people: peopleCount, apps: appCount, events: eventAttention.count }
  const openCount = Object.values(counts).reduce((a, b) => a + b, 0)
  const allEmpty = openCount === 0
  const hasData = apps.length > 0 || contacts.length > 0 || interactions.length > 0
  const fresh = allEmpty && !isDemoMode && isFreshAccount({ contacts, apps })

  // Per-row ✕ snoozes one row; a card's "Clear all" snoozes every row in it.
  const hide = id => x => prefs.snooze([`${id}:${SNOOZE_KEY[id](x)}`])
  const clearAll = groups => (
    <SectionAction onClick={() => prefs.snooze(Object.entries(groups).flatMap(([id, rows]) => rows.map(x => `${id}:${SNOOZE_KEY[id](x)}`)))}>
      Clear all
    </SectionAction>
  )

  // Every card, keyed by registry id; false when it has nothing to show right now.
  const cards = {
    pipeline: hasData && <PipelineCard apps={apps} />,
    network: hasData && <NetworkCard contacts={contacts} />,
    outreach: hasData && <OutreachCard interactions={interactions} />,
    rates: pipelineRates(apps).applied > 0 && <RatesCard apps={apps} />,
    decisions: decisions.length > 0 && (
      <DashCard label="Decisions" tone={decisions.some(a => a.offerDeadline && daysUntil(a.offerDeadline) <= 3) ? 'danger' : 'warning'}
        icon={Scale} count={decisions.length}>
        <div className="mt-1">
          <RowCap items={decisions} cap={capOf('decisions')} tier="warning" onHide={hide('decisions')}
            renderItem={a => <DecisionRow key={a.id} app={a} onOpen={openApp} />} />
        </div>
      </DashCard>
    ),
    replies: replyDrafts.length > 0 && (
      <DashCard label="Replies drafted" tone="accent" icon={PenLine} count={replyDrafts.length} actions={clearAll({ replies: replyDrafts })}>
        <p className="text-[11px] text-ink-400 mt-1">Written from the thread and your résumé. Review in Inbox, then send from Gmail.</p>
        <RowCap items={replyDrafts} cap={capOf('replies')} tier="accent" onHide={hide('replies')}
          renderItem={d => <DraftRow key={d.id} draft={d} contacts={contacts} onOpen={id => onOpenDraft?.(id)} />} />
      </DashCard>
    ),
    email: openItems.length > 0 && (
      <DashCard label="From your email" tone="warning" icon={ListTodo} count={openItems.length}
        actions={<SectionAction onClick={dismissAllItems} disabled={dismissingAll}>{dismissingAll ? 'Clearing…' : 'Dismiss all'}</SectionAction>}>
        <div className="mt-1">
          <RowCap items={openItems} cap={capOf('email')} tier="warning"
            renderItem={item => <ActionItemRow key={item.id} item={item} contacts={contacts} onRefresh={onRefresh} onOpen={openContact} />} />
        </div>
      </DashCard>
    ),
    people: peopleCount > 0 && (
      <DashCard label="People" tone={peopleGroups.overdue.length || peopleGroups.urgent.length ? 'danger' : 'warning'} icon={HeartHandshake}
        count={peopleCount} actions={clearAll(peopleGroups)}>
        <Group label="Send a thank-you" tone="accent" cap={capOf('people')} items={peopleGroups.thankYou} onHide={hide('thankYou')}
          renderItem={row => <ThankYouRow key={row.id} row={row} onRefresh={onRefresh} onOpenContact={openContact} onOpenApp={openApp} onHide={hide('thankYou')} />} />
        <Group label="Overdue follow-up" tone="danger" cap={capOf('people')} items={peopleGroups.overdue} onHide={hide('overdue')}
          renderItem={c => <OverdueRow key={c.id} contact={c} interactions={interactions} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="Awaiting reply" tone="warning" cap={capOf('people')} items={peopleGroups.awaiting} onHide={hide('awaiting')}
          renderItem={item => <AwaitingReplyRow key={item.contact.id} item={item} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="High urgency" tone="danger" cap={capOf('people')} items={peopleGroups.urgent} onHide={hide('urgent')}
          renderItem={c => <HighUrgencyRow key={c.id} contact={c} onOpen={openContact} />} />
        <Group label="Want to schedule" tone="ink" cap={capOf('people')} items={peopleGroups.schedule} onHide={hide('schedule')}
          renderItem={c => <ScheduleRow key={c.id} contact={c} onRefresh={onRefresh} onOpen={openContact} />} />
        <Group label="Keep in touch" tone="warning" cap={capOf('people')} items={peopleGroups.keepInTouch} onHide={hide('keepInTouch')}
          renderItem={({ contact: c, status }) => (
            <KeepInTouchRow key={c.id} contact={c} status={status} interactions={interactions}
              onOpen={openContact} onLog={setLogContact} onMet={handleMet} />
          )} />
      </DashCard>
    ),
    apps: appCount > 0 && (
      <DashCard label="Applications" tone={appGroups.stale.length ? 'danger' : 'warning'} icon={ClipboardCheck}
        count={appCount} actions={clearAll(appGroups)}>
        <Group label="Interviews coming up" tone="accent" cap={capOf('apps')} items={appGroups.interview} onHide={hide('interview')}
          renderItem={a => <InterviewRow key={a.id} app={a} onOpen={openApp} />} />
        <Group label="OA due" tone="warning" cap={capOf('apps')} items={appGroups.oa} onHide={hide('oa')}
          renderItem={a => <OaRow key={a.id} app={a} onOpen={openApp} onRefresh={onRefresh} onLogOa={onLogOa} />} />
        <Group label={`Stale · no movement ${staleDays}d+`} tone="danger" cap={capOf('apps')} items={appGroups.stale} onHide={hide('stale')}
          renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips={false} onOpen={openApp} changeAppTriage={changeAppTriage} />} />
        <Group label="Job boards to review" tone="warning" cap={capOf('apps')} items={appGroups.review} onHide={hide('review')}
          renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips onOpen={openApp} changeAppTriage={changeAppTriage} />} />
        <Group label="OA deadline unknown" tone="ink" cap={capOf('apps')} items={appGroups.oaCheck} onHide={hide('oaCheck')}
          renderItem={a => <OaRow key={a.id} app={a} needsCheck onOpen={openApp} onRefresh={onRefresh} onLogOa={onLogOa} />} />
      </DashCard>
    ),
    events: (eventAttention.count > 0 || eventAttention.degraded.length > 0) && (
      <EventsCard attention={eventAttention} pool={eventPool} cap={capOf('events')} onOpenEvents={onOpenEvents} />
    ),
  }
  // Rough rendered height of each action card, so half-width cards split into two columns of
  // about equal length (a glance card is about four rows tall).
  const rowsShown = (groups, cap = 3) => Object.values(groups).reduce((n, rows) => n + (rows.length ? Math.min(rows.length, cap) + 0.5 : 0), 1)
  const weight = {
    decisions: rowsShown({ items: decisions }, capOf('decisions')),
    replies: rowsShown({ items: replyDrafts }, capOf('replies')),
    email: rowsShown({ items: openItems }, capOf('email')),
    people: rowsShown(peopleGroups, capOf('people')),
    apps: rowsShown(appGroups, capOf('apps')),
    events: rowsShown({ s: eventAttention.steps, r: eventAttention.registrations, f: eventAttention.followUps }, capOf('events')) + (eventAttention.degraded.length ? 1 : 0),
  }
  const bands = layoutBands(layout.cards.filter(c => cards[c.id]))

  function renderBand(band) {
    const key = band.cards[0].id
    if (band.size === 'full') return <m.div key={key} variants={rise}>{cards[key]}</m.div>
    if (band.size === 'third') {
      // 3-up on wide screens, 2-up on tablets with an odd last card spanning both.
      const odd = band.cards.length % 2 === 1
      return (
        <div key={key} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {band.cards.map((c, i) => (
            <m.div key={c.id} variants={rise} className={odd && i === band.cards.length - 1 ? 'md:col-span-2 xl:col-span-1' : undefined}>{cards[c.id]}</m.div>
          ))}
        </div>
      )
    }
    // Halves: two stacks, balanced by height, order kept within a stack. On the default layout
    // a lone card takes the full width (as before customizing existed); once the user has
    // picked widths, a half stays a half.
    const stacks = [[], []]
    const heights = [0, 0]
    for (const c of band.cards) {
      const i = heights[0] <= heights[1] ? 0 : 1
      stacks[i].push(c); heights[i] += weight[c.id] ?? 4
    }
    if (!stacks[1].length && !customized) stacks.pop()
    return (
      <div key={key} className={`grid grid-cols-1 gap-3 items-start ${stacks.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {stacks.map((stack, i) => (
          <div key={i} className="space-y-3 min-w-0">
            {stack.map(c => <m.div key={c.id} variants={rise}>{cards[c.id]}</m.div>)}
          </div>
        ))}
      </div>
    )
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  return (
    <m.div className="space-y-3" variants={container} initial="hidden" animate="show">
      <m.div variants={rise} className="flex items-center gap-4 flex-wrap px-1">
        <Label tone={allEmpty ? 'success' : 'accent'}>
          {today} <span className="text-ink-300">/</span> {allEmpty ? 'all clear' : `${openCount} open`}
        </Label>
        <span className="ml-auto flex items-center gap-4 text-xs text-ink-400">
          {placed.email && trimmed.hidden > 0 && <span title="Already replied on the thread, long past due, or duplicates">{trimmed.hidden} resolved AI items auto-hidden</span>}
          {snoozedHidden > 0 && (
            <button onClick={prefs.clearSnoozes} className="hover:text-ink-700 hover:underline">Unhide {snoozedHidden}</button>
          )}
          {!fresh && !editing && (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 hover:text-ink-700">
              <SlidersHorizontal size={12} /> Customize
            </button>
          )}
        </span>
      </m.div>

      {editing
        ? (
          <Suspense fallback={<p className="px-1 text-xs text-ink-400">Loading the editor…</p>}>
            <TodayEditor layout={layout} update={update} reset={reset} ctx={ctx} counts={counts} onDone={() => setEditing(false)} />
          </Suspense>
        )
        : fresh
          ? <GettingStarted hasApps={apps.length > 0} hasContacts={contacts.length > 0} apps={apps} contacts={contacts} />
          : <>
            {bands.map(renderBand)}
            {allEmpty && <m.div variants={rise}><EmptyState msg={snoozedHidden ? `✓ Nothing left — ${snoozedHidden} hidden for now.` : "✓ Nothing needs your attention. You're on top of it."} /></m.div>}
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
