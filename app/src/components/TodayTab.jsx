import { useState } from 'react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, TYPE_COLOR, fmt, daysUntil, daysSince, Badge, EmptyState, isUntriaged } from '../shared.jsx'
import { updateContact, addInteraction, updateApplicationTriage, archiveApplication, updateApplication } from '../db.js'
import BarChartWrapper from './charts/BarChart.jsx'
import DonutChart from './charts/DonutChart.jsx'
import TrendChart from './charts/TrendChart.jsx'
import { STATUS_CHART_COLORS } from './charts/theme.js'
import { logMetWithContact } from '../lib/quickLog.js'
import { overdueFollowUps, staleApplications, highUrgencyContacts, wantToSchedule, oaDue, oaNeedsCheck, needsReviewApps, keepInTouchDue } from '../lib/attention.js'
import { lastPointOfContact } from '../lib/keepInTouch.js'
import { tieStrengthBucket } from '../lib/affinity.js'
import { statusIconFor } from '../lib/icons.js'
import useTimelineFinds from '../lib/useTimelineFinds.js'
import { BUCKET_CONFIG, BUCKET_TAG, BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import DraftPanel from './DraftPanel.jsx'
import SidePanel from './ui/SidePanel.jsx'
import ContactPanelBody from './panels/ContactPanelBody.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import LogInteractionModal from './LogInteractionModal.jsx'
import MetButton from './MetButton.jsx'
import TimelineFindsPanel from './TimelineFindsPanel.jsx'
import Mono from './ui/Mono.jsx'
import { Section, RowCap, HEADING_COLOR } from './ui/Section.jsx'
import { CalendarClock, Hourglass, AlertTriangle, HeartHandshake, Inbox, UserPlus, ClipboardCheck, Search, Clock, MessageSquarePlus, Activity } from 'lucide-react'

// Matches KeepInTouchTab.jsx:8 exactly — private to that component there, ported verbatim
// here since it isn't exported.
const TIE_LABEL = { strong: 'Close tie', moderate: 'Moderate tie', weak: 'Weak tie', cold: 'Not yet connected' }

// A contact whose Follow-Up Date already passed, but who has a logged interaction newer
// than that date — the date's just stale, not actually overdue. Ported verbatim from the
// former Actions tab.
function hasNewerInteraction(contact, interactions) {
  return interactions.some(i => i.contactId === contact.id && i.date && contact.followUpDate && new Date(i.date) > new Date(contact.followUpDate))
}

function OverdueRow({ contact: c, interactions, onRefresh, onOpen }) {
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
        <div className="min-w-0 cursor-pointer" onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">{c.email}</a>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge label={c.status} color={STATUS_COLOR[c.status]} />
          <p className="text-xs font-medium text-danger-600">
            Was due <Mono>{fmt(c.followUpDate)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(c.followUpDate))}d</Mono> ago)
          </p>
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
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.scheduleNote && <p className="text-xs text-ink-400 italic mt-0.5 line-clamp-1">"{c.scheduleNote}"</p>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          {c.scheduleBy && (
            <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
              {overdue
                ? <>Wanted by <Mono>{fmt(c.scheduleBy)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(c.scheduleBy))}d</Mono> ago)</>
                : <>Schedule by <Mono>{fmt(c.scheduleBy)}</Mono></>}
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

// High-urgency contacts had no click/expand behavior at all in the former Actions tab
// (rendered via the fully inert generic ActionRow) — this is a new dedicated row, not a port, but per D-05
// no new action *types* are introduced: it only gains the row-click-to-modal wiring every
// other row type gets in this phase.
function HighUrgencyRow({ contact: c, onOpen }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 cursor-pointer" onClick={() => onOpen(c)}>
          <p className="text-sm font-medium text-ink-900">{c.name}</p>
          <p className="text-xs text-ink-500">{[c.company, c.role].filter(Boolean).join(' · ')}</p>
          {c.email && <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">{c.email}</a>}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <Badge label="HIGH" color={URGENCY_COLOR.HIGH} />
          <p className="text-xs font-medium text-ink-500">
            {c.followUpDate ? <>Due <Mono>{fmt(c.followUpDate)}</Mono></> : 'No follow-up date set'}
          </p>
        </div>
      </div>
    </div>
  )
}

// Ported from KeepInTouchTab.jsx:40-87, remapped onto onOpen/onLog/onMet. `status` is the
// per-contact { cadence, dueDate, overdueDays, never } object keepInTouchDue's queue items
// carry alongside `contact` — required for the cadence/overdue text below, so it's threaded
// in as its own prop rather than recomputed here.
function KeepInTouchRow({ contact: c, status, interactions, onOpen, onLog, onMet }) {
  const last = lastPointOfContact(c, interactions)
  const bucket = tieStrengthBucket(c, interactions)
  const overdue = !status.never && status.overdueDays > 0
  return (
    <div className={`bg-white rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md ${overdue ? 'border-warning-300' : 'border-ink-100'}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onOpen(c)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-900">{c.name}</span>
            {c.company && <span className="text-sm text-ink-500">@ {c.company}</span>}
            {c.role && <span className="text-xs text-ink-400">· {c.role}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
              <Clock size={11} /> {TIE_LABEL[bucket]} · every <Mono>{status.cadence}</Mono>d
            </span>
          </div>
          <div className="mt-2 text-xs text-ink-500">
            {last ? (
              <span className="flex items-center gap-1.5 flex-wrap">
                <Badge label={last.type} color={TYPE_COLOR[last.type] || TYPE_COLOR.Other} />
                <span className="text-ink-400"><Mono>{fmt(last.date)}</Mono></span>
                {last.summary && <span className="text-ink-500 line-clamp-1 italic">— "{last.summary}"</span>}
              </span>
            ) : (
              <span className="text-ink-400">No interaction logged yet — say hello to start the thread.</span>
            )}
          </div>
        </button>

        <div className="text-right shrink-0 flex flex-col items-end gap-2">
          <span className={`text-xs font-semibold ${overdue ? 'text-accent-700' : 'text-ink-400'}`}>
            {status.never
              ? 'Never contacted'
              : status.overdueDays > 0
                ? <><Mono>{status.overdueDays}d</Mono> overdue</>
                : 'Due today'}
          </span>
          <div className="flex items-center gap-1.5">
            <MetButton contact={c} onMet={onMet} />
            <button onClick={() => onLog(c)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
              <MessageSquarePlus size={12} /> Log
            </button>
          </div>
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
    <div className="flex items-center justify-between gap-3 py-2.5 cursor-pointer" onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500">{a.role || ''}</p>
        {a.jdLink && (
          <a href={a.jdLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs text-accent-500 hover:underline">View JD ↗</a>
        )}
      </div>
      <div className="text-right shrink-0 space-y-1">
        <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
        <p className="text-xs font-medium text-ink-500">
          <Mono>{a.daysInStage ?? daysSince(a.lastActivity)}d</Mono> in {a.stage}
        </p>
        {showTriageChips && (
          <div className="flex flex-wrap gap-1 justify-end">
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
function OaRow({ app: a, needsCheck, onOpen, onRefresh }) {
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
    <div className="flex items-center justify-between gap-3 py-2.5 cursor-pointer" onClick={() => onOpen(a)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-900">{a.company}</p>
        <p className="text-xs text-ink-500">{a.role || ''}</p>
        {a.oaLink && (
          <a href={a.oaLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs text-accent-500 hover:underline">
            Open assessment ↗
          </a>
        )}
      </div>
      <div className="text-right shrink-0 space-y-1">
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
      </div>
    </div>
  )
}

// Monday-anchored ISO week start, used to bucket interactions for the trend chart.
function weekStart(d) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // 0=Monday
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

function ActivitySection({ contacts, apps, interactions }) {
  const triagedApps  = apps.filter(a => !isUntriaged(a))
  const hasRecruitingActivity = apps.length > 0

  const stageCounts = {}
  triagedApps.forEach(a => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1 })
  const funnelStages = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer']
  const funnelData = funnelStages.map(stage => ({ label: stage, value: stageCounts[stage] || 0 }))

  // Stage-to-stage conversion — new signal, cheap given stageCounts already exists.
  const conversions = []
  for (let i = 0; i < funnelStages.length - 1; i++) {
    const from = stageCounts[funnelStages[i]] || 0
    const to = stageCounts[funnelStages[i + 1]] || 0
    if (from > 0) conversions.push({ from: funnelStages[i], to: funnelStages[i + 1], pct: Math.round((to / from) * 100) })
  }

  const donutData = Object.keys(STATUS_COLOR)
    .map(status => ({ label: status, value: contacts.filter(c => c.status === status).length, color: STATUS_CHART_COLORS[status] }))
    .filter(d => d.value > 0)

  // Interactions over the trailing 10 weeks — a signal not visualized anywhere else today.
  const trendWeeks = []
  const now = weekStart(new Date())
  for (let i = 9; i >= 0; i--) {
    const start = new Date(now)
    start.setDate(start.getDate() - i * 7)
    trendWeeks.push(start)
  }
  const trendData = trendWeeks.map(start => {
    const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const count = interactions.filter(x => x.date && weekStart(x.date).getTime() === start.getTime()).length
    return { label, count }
  })
  const hasInteractions = interactions.length > 0

  return (
    <Section title="Activity" accent="ink" icon={Activity}>
      {hasRecruitingActivity && (
        <div className="py-3">
          <h3 className="text-xs font-semibold text-ink-500 mb-3">Application Funnel</h3>
          <BarChartWrapper data={funnelData} height={180} />
          {conversions.length > 0 && (
            <p className="text-xs text-ink-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {conversions.map(c => (
                <span key={c.to}>{c.from} → {c.to}: <span className="font-medium text-ink-600">{c.pct}%</span></span>
              ))}
            </p>
          )}
          {(stageCounts.Rejected || stageCounts.Accepted) && (
            <p className="text-xs text-ink-400 mt-2">
              {stageCounts.Rejected ? `${stageCounts.Rejected} rejected` : ''}
              {stageCounts.Rejected && stageCounts.Accepted ? ' · ' : ''}
              {stageCounts.Accepted ? `${stageCounts.Accepted} accepted` : ''}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3">
        <div>
          <h3 className="text-xs font-semibold text-ink-500 mb-3">Network by Status</h3>
          {contacts.length === 0
            ? <p className="text-sm text-ink-400">No contacts yet.</p>
            : <DonutChart data={donutData} centerLabel="contacts" />}
        </div>
        <div>
          <h3 className="text-xs font-semibold text-ink-500 mb-3">Networking Activity</h3>
          {!hasInteractions
            ? <p className="text-sm text-ink-400">No logged interactions yet — use "+ Log Interaction" in Network.</p>
            : <TrendChart data={trendData} />}
        </div>
      </div>
    </Section>
  )
}

export default function TodayTab({ contacts, apps, interactions = [], calls = [], relationships = [], onFindPeople, onRefresh, onRefreshRelationships, isDemoMode = false }) {
  const overdueContacts = overdueFollowUps(contacts)
  const staleApps = staleApplications(apps)
  const highUrgency = highUrgencyContacts(contacts)
  const scheduleContacts = wantToSchedule(contacts)
  const keepInTouch = keepInTouchDue(contacts, interactions)
  const needsReview = needsReviewApps(apps)
  const oaDueList = oaDue(apps)
  const oaNeedsCheckList = oaNeedsCheck(apps)

  const [selectedContactId, setSelectedContactId] = useState(null)
  const [selectedAppId, setSelectedAppId] = useState(null)
  const [logContact, setLogContact] = useState(null)
  const {
    pending: timelineFinds, running: timelineFindsRunning, error: timelineFindsError, meta: timelineFindsMeta,
    scan: scanTimelineFinds, dismiss: dismissTimelineFind, updateField: updateTimelineFindField, approve: approveTimelineFind,
  } = useTimelineFinds({ apps, calls, interactions, contacts, enabled: !isDemoMode })

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

  const selectedApp = selectedAppId ? apps.find(a => a.id === selectedAppId) : null

  // useTimelineFinds is called unconditionally near the top of this component (above this
  // gate), so its internal daily-scan effect always fires on every mount of this component
  // regardless of which branch this function's return ultimately takes — TimelineFindsPanel
  // itself may never mount below, but the hook's effect already ran. The gate's Timeline
  // Finds clause reads the hook's live pending array length directly, with no separate
  // state-synchronization step needed (unlike Plan 02-05's synced-count-state workaround,
  // which this replaces). Timeline Finds is still short-circuited/ignored in demo mode,
  // matching the section's own demo-mode exclusion below.
  const allEmpty = overdueContacts.length === 0 && staleApps.length === 0 && highUrgency.length === 0
    && keepInTouch.length === 0 && needsReview.length === 0 && scheduleContacts.length === 0
    && oaDueList.length === 0 && oaNeedsCheckList.length === 0 && (isDemoMode || timelineFinds.length === 0)

  return (
    <div className="space-y-4">
      {allEmpty && <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />}

      {overdueContacts.length > 0 && (
        <Section title={`Overdue Follow-Ups (${overdueContacts.length})`} accent="danger" icon={CalendarClock}>
          <RowCap items={overdueContacts} tier="danger"
            renderItem={c => <OverdueRow key={c.id} contact={c} interactions={interactions} onRefresh={onRefresh} onOpen={x => setSelectedContactId(x.id)} />} />
        </Section>
      )}

      {staleApps.length > 0 && (
        <Section title={`Stale Applications (${staleApps.length})`} accent="danger" icon={Hourglass}
          subtitle="No movement in 14+ days — follow up or update the stage.">
          <RowCap items={staleApps} tier="danger"
            renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips={false} onOpen={x => setSelectedAppId(x.id)} changeAppTriage={changeAppTriage} />} />
        </Section>
      )}

      {highUrgency.length > 0 && (
        <Section title={`High Urgency Contacts (${highUrgency.length})`} accent="danger" icon={AlertTriangle}>
          <RowCap items={highUrgency} tier="danger"
            renderItem={c => <HighUrgencyRow key={c.id} contact={c} onOpen={x => setSelectedContactId(x.id)} />} />
        </Section>
      )}

      {keepInTouch.length > 0 && (
        <Section title={`Keep in Touch Due (${keepInTouch.length})`} accent="warning" icon={HeartHandshake}>
          <RowCap items={keepInTouch} tier="warning"
            renderItem={({ contact: c, status }) => (
              <KeepInTouchRow key={c.id} contact={c} status={status} interactions={interactions}
                onOpen={x => setSelectedContactId(x.id)} onLog={x => setLogContact(x)} onMet={handleMet} />
            )} />
        </Section>
      )}

      {needsReview.length > 0 && (
        <Section title={`Job Boards Needs-Review (${needsReview.length})`} accent="warning" icon={Inbox}>
          <RowCap items={needsReview} tier="warning"
            renderItem={a => <ApplicationRow key={a.id} app={a} showTriageChips onOpen={x => setSelectedAppId(x.id)} changeAppTriage={changeAppTriage} />} />
        </Section>
      )}

      {scheduleContacts.length > 0 && (
        <Section title={`Want to Schedule (${scheduleContacts.length})`} accent="ink" icon={UserPlus}>
          <RowCap items={scheduleContacts} tier="ink"
            renderItem={c => <ScheduleRow key={c.id} contact={c} onRefresh={onRefresh} onOpen={x => setSelectedContactId(x.id)} />} />
        </Section>
      )}

      {oaDueList.length > 0 && (
        <Section title={`OA-Due (${oaDueList.length})`} accent="warning" icon={ClipboardCheck}>
          <RowCap items={oaDueList} tier="warning"
            renderItem={a => <OaRow key={a.id} app={a} onOpen={x => setSelectedAppId(x.id)} onRefresh={onRefresh} />} />
        </Section>
      )}

      {oaNeedsCheckList.length > 0 && (
        <Section title={`OA-Needs-Check (${oaNeedsCheckList.length})`} accent="ink" icon={Search}>
          <RowCap items={oaNeedsCheckList} tier="ink"
            renderItem={a => <OaRow key={a.id} app={a} needsCheck onOpen={x => setSelectedAppId(x.id)} onRefresh={onRefresh} />} />
        </Section>
      )}

      {!isDemoMode && !allEmpty && (
        <TimelineFindsPanel
          pending={timelineFinds} running={timelineFindsRunning} error={timelineFindsError} meta={timelineFindsMeta}
          onScan={scanTimelineFinds} onDismiss={dismissTimelineFind} onUpdateField={updateTimelineFindField} onApprove={approveTimelineFind}
        />
      )}

      <ActivitySection contacts={contacts} apps={apps} interactions={interactions} />

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
    </div>
  )
}
