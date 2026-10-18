import { useState } from 'react'
import { m } from 'motion/react'
import { CalendarCheck2, TicketCheck, MessageSquareReply, RadioTower } from 'lucide-react'
import { eventRequirementsDue, registrationClosingSoon, eventFollowUpsOverdue, degradedEventSources } from '../../lib/attention.js'
import { REQUIREMENT_LABEL } from '../../lib/eventRequirements.js'
import Mono from '../ui/Mono.jsx'
import { Section, RowCap } from '../ui/Section.jsx'

// Recruiting Events attention on Today (v1.1 Phase 14). Four more sections in Today's
// existing Section stack — the same lib/attention.js derivations, no second action queue.
// Pure helpers are exported for test/todayEvents.test.js.

const DAY = 86400000

// Calendar-day index of an instant in `timeZone` (falls back to the browser's zone).
function dayIndex(ms, timeZone) {
  let s
  try { s = new Date(ms).toLocaleDateString('en-CA', { timeZone: timeZone || undefined }) }
  catch { s = new Date(ms).toLocaleDateString('en-CA') }
  const [y, m, d] = s.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY)
}

// "due in 2d" / "due tomorrow" / "due today" / "was due today" / "overdue 3d" — counted in
// calendar days in the event's own timezone, so an 11:59 PM deadline tomorrow reads
// "tomorrow" rather than "in 1d" or "in 2d" depending on the hour you look.
// verb: 'due' | 'closes'.
export function countdownLabel(dueMs, now = Date.now(), { timeZone, verb = 'due' } = {}) {
  const days = dayIndex(dueMs, timeZone) - dayIndex(now, timeZone)
  if (dueMs < now) {
    if (days >= 0) return verb === 'closes' ? 'closed today' : 'was due today'
    return verb === 'closes' ? `closed ${-days}d ago` : `overdue ${-days}d`
  }
  if (days <= 0) return `${verb} today`
  if (days === 1) return `${verb} tomorrow`
  return `${verb} in ${days}d`
}

// Follow-up countdown from eventFollowUpsOverdue's whole-day `daysOverdue`.
export function followUpLabel(daysOverdue) {
  return daysOverdue <= 0 ? 'due today' : `overdue ${daysOverdue}d`
}

// A registration deadline that's also an incomplete required `register` step for the same
// event already appears under "Signup steps due" — showing it twice is noise, so the
// registration row is dropped in favour of the step (which carries the same deadline plus a
// "Done" action).
export function dedupeRegistrations(registrations, stepsDue) {
  const stepEvents = new Set(stepsDue.filter(s => s.requirement?.kind === 'register').map(s => s.event.id))
  return registrations.filter(r => !stepEvents.has(r.event.id))
}

// Everything Today needs from the pool, in one place. Dismissed events (relevance
// dismissedAt → effectiveTier 'dismissed') are dropped from the step/registration lists;
// follow-ups stay, since the user set those explicitly. No campus ⇒ nothing.
export function deriveEventAttention(pool, now = Date.now()) {
  const empty = { steps: [], registrations: [], followUps: [], degraded: [], count: 0 }
  if (!pool?.school) return empty
  const tierOf = pool.tierOf || (() => null)
  const events = (pool.events || []).filter(ev => tierOf(ev) !== 'dismissed')
  const userEvents = pool.userEvents || []
  const steps = eventRequirementsDue(events, pool.completions || [], { now, userEvents })
  const registrations = dedupeRegistrations(registrationClosingSoon(events, userEvents, { now }), steps)
  const followUps = eventFollowUpsOverdue(userEvents, pool.events || [], { now })
  const degraded = degradedEventSources(pool.sources)
  // `count` is actionable items only — a degraded feed is a notice, not something to clear,
  // so it alone shouldn't suppress Today's "nothing needs your attention" state.
  return { steps, registrations, followUps, degraded, count: steps.length + registrations.length + followUps.length }
}

function fmtWhen(iso, timeZone) {
  if (!iso) return ''
  const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  try { return new Date(iso).toLocaleString('en-US', { ...opts, timeZone: timeZone || undefined }) }
  catch { return new Date(iso).toLocaleString('en-US', opts) }
}

const KIND_LABEL = {
  career_fair: 'Career fair', info_session: 'Info session', coffee_chat: 'Coffee chat',
  workshop: 'Workshop', networking: 'Networking', other: 'Event',
}

function employerName(pool, ev) {
  return ev?.employerId ? pool.employers?.find(e => e.id === ev.employerId)?.name : null
}

// Shared left column: campus-tinted kind tag + clickable title + one context line.
function EventHeading({ event, pool, detail, onOpenEvents }) {
  const employer = employerName(pool, event)
  return (
    <div className="min-w-0 max-w-full">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="inline-flex items-center px-1.5 py-px rounded-sm bg-school-50 text-school-700 text-[10px] font-semibold uppercase tracking-wider">
          {KIND_LABEL[event?.kind] || 'Event'}
        </span>
        <button onClick={() => onOpenEvents?.()} className="text-left text-sm font-medium text-ink-900 hover:underline break-words">
          {event?.title || 'Untitled event'}
        </button>
      </div>
      <p className="text-xs text-ink-500 mt-0.5">
        {detail}
        {detail && (employer || event?.startsAt) ? ' · ' : ''}
        {employer && <>{employer} · </>}
        {event?.startsAt && <Mono className="text-ink-500">{fmtWhen(event.startsAt, event.timezone)}</Mono>}
      </p>
    </div>
  )
}

// Small async-action wrapper: busy flag + inline error, no optimistic state of our own —
// the pool hook updates its state only after the write succeeds.
function useRowAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function run(fn) {
    setBusy(true); setError(null)
    try { await fn() } catch (e) { setError(e?.message || 'Something went wrong') }
    finally { setBusy(false) }
  }
  return { busy, error, run }
}

const ACTION = 'text-xs text-link hover:underline disabled:opacity-40'
const QUIET = 'text-xs text-ink-400 hover:text-ink-600 hover:underline disabled:opacity-40'

function RowShell({ left, right, error }) {
  return (
    <div className="py-2.5">
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {left}
        <div className="sm:text-right sm:shrink-0 space-y-1">{right}</div>
      </div>
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  )
}

function StepRow({ item, pool, now, onOpenEvents }) {
  const { event, requirement: r, overdue } = item
  const { busy, error, run } = useRowAction()
  const label = r.label || REQUIREMENT_LABEL[r.kind] || 'Signup step'
  return (
    <RowShell error={error}
      left={<EventHeading event={event} pool={pool} onOpenEvents={onOpenEvents}
        detail={<span className="text-ink-700">{label}</span>} />}
      right={<>
        <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-warning-700'}`}>
          <Mono className="font-medium">{countdownLabel(item.dueMs, now, { timeZone: event.timezone })}</Mono>
        </p>
        <div className="flex items-center gap-2 sm:justify-end">
          {r.url && <a href={r.url} target="_blank" rel="noreferrer" className={ACTION}>Open ↗</a>}
          <button onClick={() => run(() => pool.toggleRequirement(r.id, true))} disabled={busy} className={QUIET}>
            {busy ? 'Saving...' : '✓ Done'}
          </button>
        </div>
      </>} />
  )
}

function RegistrationRow({ item, pool, now, onOpenEvents }) {
  const { event, overdue } = item
  const { busy, error, run } = useRowAction()
  const status = pool.userEventsById?.get?.(event.id)?.status || pool.userEvents?.find(u => u.eventId === event.id)?.status
  const link = event.registrationUrl || event.url
  const set = s => run(() => pool.updateUserEvent(event.id, { status: s }))
  return (
    <RowShell error={error}
      left={<EventHeading event={event} pool={pool} onOpenEvents={onOpenEvents}
        detail={<>Deadline <Mono className="text-ink-600">{fmtWhen(event.registrationDeadline, event.timezone)}</Mono></>} />}
      right={<>
        <p className={`text-xs font-medium ${overdue ? 'text-danger-600' : 'text-warning-700'}`}>
          <Mono className="font-medium">{countdownLabel(item.dueMs, now, { timeZone: event.timezone, verb: 'closes' })}</Mono>
        </p>
        <div className="flex items-center gap-2 sm:justify-end flex-wrap">
          {link && <a href={link} target="_blank" rel="noreferrer" className={ACTION}>Register ↗</a>}
          {status === 'registering'
            ? <Mono className="text-success-700">going</Mono>
            : <button onClick={() => set('registering')} disabled={busy} className={ACTION}>Going</button>}
          <button onClick={() => set('skipped')} disabled={busy} className={QUIET}>{busy ? '...' : 'Skip'}</button>
        </div>
      </>} />
  )
}

function FollowUpRow({ item, pool, onOpenEvents }) {
  const { event, userEvent, daysOverdue } = item
  const { busy, error, run } = useRowAction()
  const update = fields => run(() => pool.updateUserEvent(userEvent.eventId, fields))
  return (
    <RowShell error={error}
      left={<EventHeading event={event} pool={pool} onOpenEvents={onOpenEvents}
        detail={userEvent.notes ? <span className="italic">"{userEvent.notes}"</span> : 'Follow up with who you met'} />}
      right={<>
        <p className="text-xs font-medium text-danger-600">
          <Mono className="font-medium">{followUpLabel(daysOverdue)}</Mono>
        </p>
        <div className="flex items-center gap-2 sm:justify-end">
          <button onClick={() => update({ followupDoneAt: new Date().toISOString() })} disabled={busy} className={ACTION}>
            {busy ? 'Saving...' : '✓ Done'}
          </button>
          <button onClick={() => update({ followupDueAt: new Date(Date.now() + 2 * DAY).toISOString() })} disabled={busy} className={QUIET}>
            Snooze 2d
          </button>
        </div>
      </>} />
  )
}

// The three deadline sections, rendered as siblings in TodayTab's stagger stack.
// `fold(id)` (optional) → { collapsed, onToggle } so Today's collapse controls reach these too.
export function EventDeadlineSections({ attention, pool, onOpenEvents, rise, fold = () => ({}), now = Date.now() }) {
  const { steps, registrations, followUps } = attention
  return (
    <>
      {steps.length > 0 && (
        <m.div variants={rise}>
          <Section title={`Signup Steps Due (${steps.length})`} {...fold('evSteps')} accent="warning" icon={CalendarCheck2}
            subtitle="Required steps before a recruiting event lets you in.">
            <RowCap items={steps} tier="warning"
              renderItem={it => <StepRow key={it.requirement.id} item={it} pool={pool} now={now} onOpenEvents={onOpenEvents} />} />
          </Section>
        </m.div>
      )}
      {registrations.length > 0 && (
        <m.div variants={rise}>
          <Section title={`Registration Closing (${registrations.length})`} {...fold('evReg')} accent="warning" icon={TicketCheck}>
            <RowCap items={registrations} tier="warning"
              renderItem={it => <RegistrationRow key={it.event.id} item={it} pool={pool} now={now} onOpenEvents={onOpenEvents} />} />
          </Section>
        </m.div>
      )}
      {followUps.length > 0 && (
        <m.div variants={rise}>
          <Section title={`Event Follow-Ups Overdue (${followUps.length})`} {...fold('evFollow')} accent="danger" icon={MessageSquareReply}>
            <RowCap items={followUps} tier="danger"
              renderItem={it => <FollowUpRow key={it.userEvent.eventId} item={it} pool={pool} onOpenEvents={onOpenEvents} />} />
          </Section>
        </m.div>
      )}
    </>
  )
}

// Quiet feed-health notice: one line per degraded source. Informational, not a to-do.
export function EventFeedHealth({ attention, rise, fold = () => ({}) }) {
  const { degraded } = attention
  if (!degraded.length) return null
  return (
    <m.div variants={rise}>
      <Section title={`Event Feeds Degraded (${degraded.length})`} {...fold('evFeeds')} accent="ink" icon={RadioTower}
        subtitle="Nothing from these feeds was written — events from them may be missing or stale.">
        {degraded.map(s => (
          <div key={s.id} className="py-2 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="text-sm text-ink-800 font-medium shrink-0">{s.label || s.ref || 'Feed'}</span>
            <span className="text-xs text-ink-500 min-w-0 break-words">
              {s.degradedReason || 'Feed looks stale'}
              {s.degradedAt && <> · since <Mono className="text-ink-500">{fmtWhen(s.degradedAt)}</Mono></>}
            </span>
          </div>
        ))}
      </Section>
    </m.div>
  )
}
