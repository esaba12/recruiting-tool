// Recruiting event detail — the SidePanel body opened from Calendar → Events.
// Industrial / control-panel, like EventsView: hairline-ruled sections with
// uppercase micro-labels, Mono for every date/time/countdown, accent only on the
// primary action (Add to Recruiting calendar).
//
// Sections: facts (when/where/employers/attributes/source) · relevance (tier,
// why, override, dismiss) · your status (confirmed/attended gated by the
// requirement ladder) · signup steps · calendar conflicts · Google Calendar push ·
// follow-up · notes. Every write goes through the eventPool / eventCalendarSync
// APIs; failures land in one inline error banner and never close the panel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Check, EyeOff, Eye } from 'lucide-react'
import { canSetStatus, requirementLadder, REQUIREMENT_LABEL } from '../../lib/eventRequirements.js'
import { conflictsForEvent } from '../../lib/conflicts.js'
import {
  STATUS_OPTIONS, STATUS_LABEL, TIER_LABEL, employerNamesFor, timeRangeLabel, zoneAbbrev, eventZone,
  dayKeyInZone, dayLabel, countdownLabel, dateTimeLabel, dueLabel, registrationCountdown, staleInfo,
  requirementName, eventEndMs, kindLabel,
} from '../../lib/eventView.js'
import { Badge } from '../../shared.jsx'
import Mono from '../ui/Mono.jsx'
import { DayPlanSection, CaptureSection } from '../events/EventDayPlan.jsx'

const DAY = 86400000
const MICRO = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500'
const SECONDARY_BTN = 'px-2.5 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed'

// Shared with EventsView's rows (kept here so the import only runs one way).
export const STATUS_BADGE = {
  interested:  'bg-ink-100 text-ink-700',
  registering: 'bg-warning-100 text-warning-800',
  confirmed:   'bg-success-100 text-success-800',
  attended:    'bg-success-50 text-success-700',
  skipped:     'bg-ink-100 text-ink-500',
}

// Three-segment relevance meter (high = 3 lit). Ink, not accent — accent is for actions.
export function TierMeter({ tier }) {
  const lit = { high: 3, medium: 2, low: 1 }[tier] || 0
  return (
    <span className="inline-flex items-end gap-[2px] shrink-0" title={tier && tier !== 'dismissed' ? `Relevance: ${tier}` : 'Dismissed'} aria-label={`Relevance ${tier || 'none'}`}>
      {[0, 1, 2].map(i => (
        <span key={i} className={`w-[3px] rounded-[1px] ${i < lit ? 'bg-ink-800' : 'bg-ink-200'}`} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  )
}

export function KindTag({ kind }) {
  return (
    <span className="shrink-0 px-1.5 py-px border border-ink-300 rounded-sm text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-600">
      {kindLabel(kind)}
    </span>
  )
}

export function MarkerTag({ children, className = '' }) {
  return <span className={`shrink-0 px-1.5 py-px rounded-sm text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>{children}</span>
}

function Section({ label, aside, children }) {
  return (
    <section className="px-5 py-4 border-b border-ink-200">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className={MICRO}>{label}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, children }) {
  return (
    <>
      <dt className={`${MICRO} pt-0.5`}>{label}</dt>
      <dd className="text-sm text-ink-800 min-w-0 break-words">{children}</dd>
    </>
  )
}

const SOURCE_LABEL = { localist: 'Campus feed', paste: 'Pasted', csv: 'CSV import', ics: 'ICS import', manual: 'Added by hand' }

export default function EventPanelBody({ event: ev, pool, sync = null, calendar = { status: 'idle', blocks: [] }, isDemoMode = false, onClose, apps = [], contacts = [], onContactsChanged }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const userEvent = pool.userEventsById.get(ev.id) || null
  const [notes, setNotes] = useState(userEvent?.notes || '')
  const [notesSaved, setNotesSaved] = useState(false)

  // Escape / backdrop close the panel without blurring the textarea — flush unsaved notes on unmount.
  const notesRef = useRef({ draft: notes, saved: userEvent?.notes || '' })
  notesRef.current.draft = notes
  useEffect(() => () => {
    const { draft, saved } = notesRef.current
    if (draft !== saved) pool.updateUserEvent(ev.id, { notes: draft }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = Date.now()
  const tz = eventZone(ev, pool.school?.timezone)
  const employersById = useMemo(() => new Map((pool.employers || []).map(e => [e.id, e])), [pool.employers])
  const names = employerNamesFor(ev, employersById)
  const rel = pool.relevance?.get(ev.id) || null
  const tier = pool.tierOf(ev)
  const dismissed = tier === 'dismissed'
  const ladder = requirementLadder(ev.requirements, pool.completions)
  const requiredLeft = ladder.filter(r => r.required !== false && !r.completed).length
  const confirmAllowed = canSetStatus('confirmed', ev.requirements, pool.completions)
  const stale = staleInfo(ev, now)
  const reg = registrationCountdown(ev, now)
  const past = eventEndMs(ev) < now
  const dayKey = dayKeyInZone(ev.startsAt, tz)
  const daysUntil = Math.round((Date.parse(`${dayKey}T00:00:00Z`) - Date.parse(`${dayKeyInZone(now, tz)}T00:00:00Z`)) / DAY)
  const pushed = !!userEvent?.calendarEventId

  // Per-user transit override (recruiting_calendar_sync setting) wins over the school default.
  const transitMin = sync?.setting?.transitBufferMin ?? pool.school?.transitBufferMin ?? 15
  const conflicts = useMemo(() => {
    if (calendar.status !== 'ready') return null
    try { return conflictsForEvent(ev, calendar.blocks, { userEvent, school: pool.school, transitBufferMin: transitMin }) } catch { return null }
  }, [calendar.status, calendar.blocks, ev, userEvent, pool.school, transitMin])

  async function run(key, fn) {
    setBusy(key); setError(null)
    try { await fn(); return true } catch (e) { setError(e.message || String(e)); return false } finally { setBusy(null) }
  }

  const setStatus = status => {
    if (status === userEvent?.status) return
    if (!canSetStatus(status, ev.requirements, pool.completions)) {
      setError('Complete every required signup step before marking this confirmed.')
      return
    }
    run(`status:${status}`, () => pool.setStatus(ev.id, status))
  }

  async function saveNotes() {
    if (notes === (userEvent?.notes || '')) return
    const ok = await run('notes', () => pool.updateUserEvent(ev.id, { notes }))
    if (ok) { notesRef.current.saved = notes; setNotesSaved(true) }
  }

  const attrs = ev.attributes || {}
  const where = [ev.isVirtual && 'Virtual', ev.location && ev.location.toLowerCase() !== 'virtual' && ev.location].filter(Boolean).join(' · ')
  const followDue = userEvent?.followupDueAt && !userEvent?.followupDoneAt ? dueLabel(userEvent.followupDueAt, now, tz) : null

  return (
    <>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-ink-300 px-5 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <KindTag kind={ev.kind} />
              {ev.visibility === 'private' && <MarkerTag className="border border-dashed border-ink-400 text-ink-600">Private</MarkerTag>}
              {stale && <MarkerTag className="bg-warning-100 text-warning-800"><Mono className="text-[10px]">{stale.label}</Mono></MarkerTag>}
              {userEvent?.status && <Badge label={STATUS_LABEL[userEvent.status]} color={STATUS_BADGE[userEvent.status]} />}
            </div>
            <h2 className="text-base font-bold text-ink-900 leading-snug">{ev.title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 w-7 h-7 rounded-sm border border-ink-200 hover:bg-ink-100 flex items-center justify-center text-ink-500 text-sm">✕</button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 px-3 py-2 bg-danger-50 border border-danger-200 rounded-sm text-xs text-danger-700 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss error" className="shrink-0">✕</button>
        </div>
      )}

      {/* Facts */}
      <section className="px-5 py-4 border-b border-ink-200">
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5">
          <Fact label="When">
            <Mono className="text-sm text-ink-900">{dayLabel(dayKey)} · {timeRangeLabel(ev, tz)}{!ev.allDay && ` ${zoneAbbrev(ev, tz)}`}</Mono>
            <Mono className="block text-ink-500 mt-0.5">{past ? 'ended' : countdownLabel(daysUntil)}</Mono>
          </Fact>
          {where && <Fact label="Where">{where}</Fact>}
          {names.length > 0 && <Fact label={names.length > 1 ? 'Employers' : 'Employer'}>{names.join(', ')}</Fact>}
          {ev.registrationDeadline && (
            <Fact label="Register by">
              <Mono className="text-sm text-ink-900">{dateTimeLabel(ev.registrationDeadline, tz)}</Mono>
              {reg && <Mono className={`block mt-0.5 ${reg.urgent ? 'text-danger-700 font-semibold' : 'text-warning-700'}`}>{reg.label}</Mono>}
              {!reg && Date.parse(ev.registrationDeadline) < now && <Mono className="block mt-0.5 text-ink-500">registration closed</Mono>}
            </Fact>
          )}
          {attrs.roles?.length > 0 && <Fact label="Roles">{attrs.roles.join(' · ')}</Fact>}
          {attrs.majors?.length > 0 && <Fact label="Majors">{attrs.majors.join(' · ')}</Fact>}
          {(attrs.format || attrs.sponsorship) && (
            <Fact label="Format">
              {[attrs.format && attrs.format.replace(/_/g, ' '), attrs.sponsorship && attrs.sponsorship !== 'unknown' && `sponsorship: ${attrs.sponsorship}`].filter(Boolean).join(' · ') || '—'}
            </Fact>
          )}
          <Fact label="Source">
            <span className="text-ink-700">{SOURCE_LABEL[ev.sourceKind] || ev.sourceKind}</span>
            {pool.school && <> · <Badge label={pool.school.name} color="bg-school-100 text-school-700" /></>}
            {ev.confidence < 1 && <Mono className="text-ink-500"> · confidence {Math.round(ev.confidence * 100)}%</Mono>}
            {stale && <Mono className="block mt-0.5 text-warning-700">{stale.label} — details may have changed; check the event page</Mono>}
          </Fact>
        </dl>
        {(ev.url || ev.registrationUrl) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {ev.registrationUrl && (
              <a href={ev.registrationUrl} target="_blank" rel="noreferrer" className={`${SECONDARY_BTN} inline-flex items-center gap-1`}>Registration <ArrowUpRight size={12} /></a>
            )}
            {ev.url && (
              <a href={ev.url} target="_blank" rel="noreferrer" className={`${SECONDARY_BTN} inline-flex items-center gap-1`}>Event page <ArrowUpRight size={12} /></a>
            )}
          </div>
        )}
        {ev.description && <p className="mt-3 text-xs text-ink-600 leading-relaxed whitespace-pre-line">{ev.description}</p>}
      </section>

      {/* Relevance */}
      <Section label="Relevance" aside={<TierMeter tier={tier} />}>
        {dismissed ? (
          <p className="text-sm text-ink-600">Dismissed — hidden from For you and Today.</p>
        ) : (
          <p className="text-sm text-ink-800">
            <span className="font-semibold">{TIER_LABEL[tier] || 'Low'}</span>
            {rel?.overrideTier && <span className="text-ink-500"> (set by you)</span>}
            {rel?.reason && <span className="text-ink-600"> — {rel.reason}</span>}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <label className="flex items-center gap-1.5 text-xs text-ink-600">
            <span className={MICRO}>Tier</span>
            <select value={rel?.overrideTier || ''} disabled={busy === 'override' || dismissed}
              onChange={e => run('override', () => pool.setOverride(ev.id, e.target.value || null))}
              className="px-2 py-1 border border-ink-300 rounded-sm bg-surface text-xs text-ink-700 focus:outline-none focus:border-accent-400 disabled:opacity-50">
              <option value="">Auto{rel?.tier ? ` (${rel.tier})` : ''}</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <button onClick={() => run('dismiss', () => pool.dismiss(ev.id, !dismissed))} disabled={busy === 'dismiss'}
            className={`${SECONDARY_BTN} inline-flex items-center gap-1`}>
            {dismissed ? <><Eye size={12} /> Restore</> : <><EyeOff size={12} /> Dismiss</>}
          </button>
        </div>
      </Section>

      {/* Status */}
      <Section label="Your status">
        <div className="flex flex-wrap border border-ink-300 rounded-sm overflow-hidden w-fit max-w-full text-xs font-medium">
          {STATUS_OPTIONS.map(s => {
            const gated = !canSetStatus(s, ev.requirements, pool.completions)
            const active = userEvent?.status === s
            return (
              <button key={s} onClick={() => setStatus(s)} disabled={gated || !!busy} aria-pressed={active}
                title={gated ? `Finish ${requiredLeft} required signup step${requiredLeft === 1 ? '' : 's'} first` : undefined}
                className={`px-2.5 py-1 border-r border-ink-200 last:border-r-0 transition-colors disabled:cursor-not-allowed ${
                  active ? 'bg-ink-900 text-on-fill'
                    : gated ? 'bg-surface text-ink-300 line-through decoration-ink-300'
                    : 'bg-surface text-ink-600 hover:bg-ink-50'}`}>
                {STATUS_LABEL[s]}
              </button>
            )
          })}
        </div>
        {!confirmAllowed && (
          <p className="mt-2 text-xs text-ink-500">
            <span className="font-semibold text-ink-700">Going</span> and <span className="font-semibold text-ink-700">Attended</span> unlock once every required step below is done — <Mono className="text-ink-700">{requiredLeft}</Mono> left.
          </p>
        )}
      </Section>

      {/* Signup steps */}
      {ladder.length > 0 && (
        <Section label="Signup steps" aside={<Mono className="text-ink-500">{ladder.filter(r => r.completed).length}/{ladder.length}</Mono>}>
          <ol className="border border-ink-200 rounded-sm divide-y divide-ink-100">
            {ladder.map((r, i) => {
              const due = !r.completed ? dueLabel(r.dueAt, now, tz) : null
              return (
                <li key={r.id} className="flex items-start gap-2.5 px-2.5 py-2">
                  <input type="checkbox" checked={r.completed} disabled={busy === `req:${r.id}`}
                    onChange={() => run(`req:${r.id}`, () => pool.toggleRequirement(r.id, !r.completed))}
                    aria-label={`Mark "${requirementName(r)}" ${r.completed ? 'not done' : 'done'}`}
                    className="mt-0.5 accent-accent-600 shrink-0" />
                  <Mono className="text-ink-400 pt-px shrink-0">{String(i + 1).padStart(2, '0')}</Mono>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${r.completed ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{requirementName(r)}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-ink-500">
                      {r.label && REQUIREMENT_LABEL[r.kind] && <span>{REQUIREMENT_LABEL[r.kind]}</span>}
                      {r.required === false && <span className="uppercase tracking-[0.12em] text-[10px] font-semibold text-ink-400">optional</span>}
                      {r.dueAt && (
                        <Mono className={`text-[11px] ${due?.overdue ? 'text-danger-700 font-semibold' : due?.soon ? 'text-warning-700' : 'text-ink-500'}`}>
                          {dateTimeLabel(r.dueAt, tz)}{due ? ` · ${due.label}` : ''}
                        </Mono>
                      )}
                      {r.completed && <span className="inline-flex items-center gap-0.5 text-success-700"><Check size={11} /> done</span>}
                    </div>
                  </div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noreferrer" aria-label="Open step link" className="shrink-0 text-ink-500 hover:text-ink-900 pt-0.5"><ArrowUpRight size={14} /></a>
                  )}
                </li>
              )
            })}
          </ol>
        </Section>
      )}

      {/* Conflicts */}
      <Section label="Your calendar">
        {calendar.status === 'demo' ? (
          <p className="text-xs text-ink-500">Conflict checks read your Google Calendar — not connected in the demo.</p>
        ) : calendar.status === 'loading' || calendar.status === 'idle' ? (
          <Mono className="text-ink-400">checking…</Mono>
        ) : calendar.status === 'error' || !conflicts ? (
          <p className="text-xs text-ink-500" title={calendar.error || undefined}>Couldn't check your calendar. Connect Google Calendar in Settings to see conflicts.</p>
        ) : (
          <>
            <p className={`text-sm font-semibold ${conflicts.summary === 'No usable window' ? 'text-danger-700' : conflicts.fullyFree ? 'text-success-700' : 'text-warning-800'}`}>
              {conflicts.summary.startsWith('Free ')
                ? <>Free <Mono className="text-sm">{conflicts.summary.slice(5)}</Mono></>
                : conflicts.summary}
            </p>
            {!conflicts.fullyFree && conflicts.hardBlocks.length > 0 && (
              <p className="text-xs text-ink-500 mt-1">
                Around {conflicts.hardBlocks.map(b => b.title || 'busy').join(', ')} · <Mono>{transitMin}</Mono> min transit each way
              </p>
            )}
            {conflicts.softOverlaps.length > 0 && (
              <ul className="mt-2 space-y-1">
                {conflicts.softOverlaps.map(o => (
                  <li key={o.id} className="text-xs text-ink-600 flex flex-wrap gap-x-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">soft</span>
                    overlaps {o.title || 'an all-day event'} <Mono className="text-ink-500">{o.overlapMinutes} min</Mono>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <DayPlanSection event={ev} pool={pool} apps={apps} contacts={contacts} conflicts={conflicts} tz={tz} />

      {/* Google Calendar push */}
      <Section label="Recruiting calendar" aside={pushed && userEvent?.calendarSyncedAt ? <Mono className="text-ink-400">synced {dateTimeLabel(userEvent.calendarSyncedAt, tz)}</Mono> : null}>
        {isDemoMode || !sync ? (
          <>
            <button disabled className={SECONDARY_BTN}>Add to Recruiting calendar</button>
            <p className="mt-1.5 text-xs text-ink-500">{isDemoMode ? 'Google Calendar isn\'t connected in the demo.' : 'Calendar sync isn\'t available for this account yet.'}</p>
          </>
        ) : sync.needsReconnect ? (
          <>
            <button disabled className={SECONDARY_BTN}>Add to Recruiting calendar</button>
            <p className="mt-1.5 text-xs text-warning-800">Reconnect Google Calendar in Settings so the app can manage its Recruiting calendar.</p>
          </>
        ) : !sync.ready ? (
          <>
            <button disabled className={SECONDARY_BTN}>Add to Recruiting calendar</button>
            <p className="mt-1.5 text-xs text-ink-500">Connect Google Calendar and turn on Recruiting calendar sync in Settings.</p>
          </>
        ) : pushed ? (
          <>
            <button onClick={() => run('unpush', () => sync.unpush(ev))} disabled={!!busy} className={SECONDARY_BTN}>
              {busy === 'unpush' ? 'Removing…' : 'Remove from Recruiting calendar'}
            </button>
            <p className="mt-1.5 text-xs text-ink-500">On your Recruiting calendar, with a reminder for each open signup step.</p>
          </>
        ) : (
          <button onClick={() => run('push', () => sync.push(ev))} disabled={!!busy || sync.syncing}
            className="px-3 py-1.5 bg-accent-600 text-on-accent rounded-sm text-xs font-semibold hover:bg-accent-700 disabled:opacity-50">
            {busy === 'push' ? 'Adding…' : 'Add to Recruiting calendar'}
          </button>
        )}
        {sync?.error && !isDemoMode && <p className="mt-1.5 text-xs text-danger-700">Sync: {sync.error}</p>}
      </Section>

      <CaptureSection event={ev} pool={pool} contacts={contacts} onContactsChanged={onContactsChanged} />

      {/* Follow-up (set after attending; Today nags when overdue) */}
      {userEvent?.followupDueAt && (
        <Section label="Follow-up">
          {userEvent.followupDoneAt ? (
            <p className="text-xs text-success-700">Done <Mono>{dateTimeLabel(userEvent.followupDoneAt, tz)}</Mono></p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Mono className={followDue?.overdue ? 'text-danger-700 font-semibold' : 'text-ink-700'}>
                {dateTimeLabel(userEvent.followupDueAt, tz)}{followDue ? ` · ${followDue.label}` : ''}
              </Mono>
              <button onClick={() => run('followup', () => pool.updateUserEvent(ev.id, { followupDoneAt: new Date().toISOString() }))}
                disabled={!!busy} className={SECONDARY_BTN}>Mark done</button>
            </div>
          )}
        </Section>
      )}

      {/* Notes */}
      <Section label="Notes" aside={busy === 'notes' ? <Mono className="text-ink-400">saving…</Mono> : notesSaved ? <Mono className="text-ink-400">saved</Mono> : null}>
        <textarea value={notes} onChange={e => { setNotes(e.target.value); setNotesSaved(false) }} onBlur={saveNotes} rows={4}
          placeholder="Booths to hit, who to ask for, what to bring…"
          className="w-full px-2.5 py-2 border border-ink-300 rounded-sm bg-surface text-sm text-ink-800 focus:outline-none focus:border-accent-400 resize-y" />
      </Section>
    </>
  )
}
