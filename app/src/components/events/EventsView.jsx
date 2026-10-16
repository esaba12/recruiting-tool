// Calendar → Events. The school's Recruiting Events pool (career fairs, info
// sessions, coffee chats) as a filterable, day-grouped list; a row opens
// EventPanelBody in the SidePanel.
//
// Visual direction: industrial / control-panel. Hairline ink-200/300 rules,
// rounded-sm, dense ~h-12 rows, IBM Plex Mono (via Mono) for every
// date/time/countdown/count, uppercase tracked micro-labels for headers — the
// same vocabulary as ApplicationsSheet. Accent is reserved for the primary
// action; school-* identifies the campus.
//
// Data: everything comes from the `eventPool` object (lib/useRecruitingEvents.js).
// Calendar blocks for the conflict engine are fetched once here for the pool's
// whole window (googleCalendar.js listEvents), never per panel open, and fail soft.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Search, Upload, X } from 'lucide-react'
import { listEvents } from '../../googleCalendar.js'
import {
  EVENT_FILTERS, STATUS_LABEL, eventFacts, matchesFilter, filterCounts, kindsPresent, kindLabel,
  matchesSearch, employerNamesFor, formatEmployerList, groupByDay, countdownLabel, timeRangeLabel,
  nextStepInfo, registrationCountdown, staleInfo,
} from '../../lib/eventView.js'
import { Badge } from '../../shared.jsx'
import Mono from '../ui/Mono.jsx'
import SidePanel from '../ui/SidePanel.jsx'
import EventPanelBody, { TierMeter, KindTag, MarkerTag, STATUS_BADGE } from '../panels/EventPanelBody.jsx'
import EventImportModal from '../EventImportModal.jsx'

const DAY = 86400000
const MICRO = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500'

function EmptyPanel({ title, children }) {
  return (
    <div className="bg-surface border border-ink-300 rounded-sm px-5 py-10 text-center">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {children && <div className="mt-1.5 text-xs text-ink-500 space-y-3">{children}</div>}
    </div>
  )
}

function EventRow({ ev, pool, employersById, now, onOpen }) {
  const tier = pool.tierOf(ev)
  const userEvent = pool.userEventsById.get(ev.id)
  const names = employerNamesFor(ev, employersById)
  const next = nextStepInfo(ev, pool.completions, now)
  const reg = registrationCountdown(ev, now)
  const stale = staleInfo(ev, now)
  const place = ev.isVirtual ? (ev.location && ev.location.toLowerCase() !== 'virtual' ? `Virtual · ${ev.location}` : 'Virtual') : ev.location

  return (
    <button onClick={() => onOpen(ev.id)}
      className="w-full text-left flex flex-col sm:flex-row gap-1 sm:gap-3 px-3 py-2 min-h-12 hover:bg-ink-50 focus-visible:bg-ink-50 focus:outline-none transition-colors">
      <Mono className="sm:w-[5.75rem] shrink-0 pt-0.5 text-ink-700">{timeRangeLabel(ev)}</Mono>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <TierMeter tier={tier} />
          <span className="text-sm font-semibold text-ink-900 line-clamp-2 sm:truncate">{ev.title}</span>
          {userEvent?.status && (
            <span className="ml-auto shrink-0"><Badge label={STATUS_LABEL[userEvent.status] || userEvent.status} color={STATUS_BADGE[userEvent.status]} /></span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <KindTag kind={ev.kind} />
          {names.length > 0 && <span className="text-ink-700 font-medium min-w-0 truncate max-w-[14rem]" title={names.join(', ')}>{formatEmployerList(names)}</span>}
          {place && <span className="min-w-0 truncate max-w-[14rem]">{place}</span>}
          {ev.visibility === 'private' && <MarkerTag className="border border-dashed border-ink-400 text-ink-600">Private</MarkerTag>}
          {stale && <MarkerTag className="bg-warning-100 text-warning-800" ><Mono className="text-[10px]">{stale.label}</Mono></MarkerTag>}
          {reg && <Mono className={reg.urgent ? 'text-danger-700 font-semibold' : 'text-warning-700'}>{reg.label}</Mono>}
        </div>
        {next && (
          <p className={`text-xs truncate ${next.overdue ? 'text-danger-700 font-semibold' : 'text-ink-600'}`}>
            Next: {next.name}
            {next.due && <Mono className={next.overdue ? 'text-danger-700' : next.soon ? 'text-warning-700' : 'text-ink-500'}> · {next.due}</Mono>}
          </p>
        )}
      </div>
    </button>
  )
}

export default function EventsView({ eventPool, eventCalendarSync = null, isDemoMode = false, apps = [], contacts = [], onRefresh }) {
  const [filter, setFilter] = useState('forYou')
  const [kind, setKind] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [calendar, setCalendar] = useState({ status: isDemoMode ? 'demo' : 'idle', blocks: [], error: null })
  const fetchedRef = useRef(false)

  const pool = eventPool
  const events = pool?.events || []
  const now = Date.now()
  const employersById = useMemo(() => new Map((pool?.employers || []).map(e => [e.id, e])), [pool?.employers])

  // One listEvents() over the pool's whole window, once per mount. Fail soft.
  useEffect(() => {
    if (isDemoMode || fetchedRef.current || !events.length) return
    fetchedRef.current = true
    const starts = events.map(e => Date.parse(e.startsAt)).filter(n => !Number.isNaN(n))
    const ends = events.map(e => Date.parse(e.endsAt || e.startsAt) + DAY).filter(n => !Number.isNaN(n))
    const timeMin = new Date(Math.min(...starts) - DAY).toISOString()
    const timeMax = new Date(Math.max(...ends)).toISOString()
    setCalendar({ status: 'loading', blocks: [], error: null })
    listEvents({ timeMin, timeMax })
      .then(blocks => setCalendar({ status: 'ready', blocks, error: null }))
      .catch(e => setCalendar({ status: 'error', blocks: [], error: e.message }))
  }, [isDemoMode, events])

  const facts = useMemo(
    () => events.map(ev => eventFacts(ev, { tier: pool.tierOf(ev), status: pool.userEventsById.get(ev.id)?.status || null, now })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, pool?.relevance, pool?.userEventsById])
  const counts = useMemo(() => filterCounts(facts), [facts])
  const kinds = useMemo(() => kindsPresent(events), [events])

  const visible = facts
    .filter(f => matchesFilter(filter, f))
    .filter(f => kind === 'all' || (f.ev.kind || 'other') === kind)
    .filter(f => matchesSearch(f.ev, search, employerNamesFor(f.ev, employersById)))
    .map(f => f.ev)
  const groups = groupByDay(visible, { now, fallbackTz: pool?.school?.timezone, order: filter === 'past' ? 'desc' : 'asc' })

  const selected = selectedId ? events.find(e => e.id === selectedId) : null
  const degraded = (pool?.sources || []).filter(s => s.degradedAt)
  const filtersActive = kind !== 'all' || search.trim() !== ''

  // ── no campus ──
  if (!pool || (!pool.school && !pool.loading && !events.length)) {
    return (
      <EmptyPanel title="Pick your campus to see recruiting events">
        <p>Career fairs, info sessions and coffee chats come from your school's event feeds. Choose your campus in <span className="font-semibold text-ink-700">Settings → Profile</span> and they'll show up here.</p>
      </EmptyPanel>
    )
  }

  return (
    <div className="space-y-3">
      {/* Feed health — degraded sources are paused, never silently stale. */}
      {degraded.map(s => (
        <div key={s.id} className="flex items-start gap-2 px-3 py-2 bg-warning-50 border border-warning-200 rounded-sm text-xs text-warning-800">
          <AlertTriangle size={14} className="shrink-0 mt-px" />
          <p className="min-w-0">
            <span className="font-semibold">{s.label || s.kind} paused</span> — {s.degradedReason || 'the feed looked out of date'}. Nothing from it is being added until a fresh pull passes.
          </p>
        </div>
      ))}
      {pool.error && (
        <div className="px-3 py-2 bg-danger-50 border border-danger-200 rounded-sm text-xs text-danger-700">Couldn't load events: {pool.error}</div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full overflow-x-auto border border-ink-300 rounded-sm text-xs font-medium">
          {EVENT_FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 border-r border-ink-200 last:border-r-0 transition-colors ${filter === f.key ? 'bg-ink-900 text-on-fill' : 'bg-surface text-ink-600 hover:bg-ink-50'}`}>
              {f.label} <Mono className={filter === f.key ? 'text-on-fill opacity-70' : 'text-ink-400'}>{counts[f.key]}</Mono>
            </button>
          ))}
        </div>
        <select value={kind} onChange={e => setKind(e.target.value)} aria-label="Event kind"
          className="px-2 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-700 focus:outline-none focus:border-accent-400">
          <option value="all">All kinds</option>
          {kinds.map(k => <option key={k} value={k}>{kindLabel(k)}</option>)}
        </select>
        <label className="flex items-center gap-1.5 px-2 py-1 border border-ink-300 rounded-sm bg-surface text-xs w-full sm:w-48 focus-within:border-accent-400">
          <Search size={12} className="text-ink-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find event, employer, room…"
            className="w-full min-w-0 bg-transparent outline-none text-ink-800" />
          {search && <button onClick={() => setSearch('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700"><X size={12} /></button>}
        </label>
        <div className="flex items-center gap-2 sm:ml-auto">
          {pool.school && <Badge label={pool.school.name} color="bg-school-100 text-school-700" />}
          {(pool.loading || pool.enriching) && <Mono className="text-ink-400">{pool.enriching ? 'enriching…' : 'loading…'}</Mono>}
          <button onClick={() => setImportOpen(true)} disabled={!pool.school || isDemoMode}
            title={isDemoMode ? 'Importing needs an account — sign up to add your own events' : undefined}
            className="flex items-center gap-1 px-2.5 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-600 hover:bg-ink-50 disabled:opacity-50">
            <Upload size={13} /> Import events
          </button>
        </div>
      </div>

      {/* List */}
      {groups.length === 0 ? (
        pool.loading && !events.length ? (
          <EmptyPanel title="Loading events…" />
        ) : (counts.upcoming === 0 && (filter === 'forYou' || filter === 'upcoming') && !filtersActive) ? (
          <EmptyPanel title="Nothing upcoming in your campus pool">
            <p>Feeds refresh daily. Events from Handshake, Career Fair Plus and other sign-in-only sites can be added by pasting them in.</p>
            <button onClick={() => setImportOpen(true)} disabled={isDemoMode} className="disabled:opacity-50 px-3 py-1.5 bg-accent-600 text-on-accent rounded-sm text-xs font-semibold hover:bg-accent-700">
              Import events
            </button>
          </EmptyPanel>
        ) : (
          <EmptyPanel title="No events match these filters">
            <p>
              {filter === 'forYou' && counts.upcoming > 0 && <>Nothing is ranked high or medium for you right now — <button onClick={() => setFilter('upcoming')} className="text-link font-semibold hover:underline">see all <Mono>{counts.upcoming}</Mono> upcoming</button>. </>}
              {filtersActive && <button onClick={() => { setKind('all'); setSearch('') }} className="text-link font-semibold hover:underline">Clear kind &amp; search</button>}
            </p>
          </EmptyPanel>
        )
      ) : (
        <div className="bg-surface border border-ink-300 rounded-sm">
          {groups.map(g => (
            <section key={g.key} className="border-b border-ink-200 last:border-b-0">
              <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-3 py-1.5 bg-ink-50 border-b border-ink-200">
                <span className={MICRO}>{g.label}</span>
                <Mono className="text-ink-500">{countdownLabel(g.daysUntil)} · {g.events.length}</Mono>
              </header>
              <div className="divide-y divide-ink-100">
                {g.events.map(ev => (
                  <EventRow key={ev.id} ev={ev} pool={pool} employersById={employersById} now={now} onOpen={setSelectedId} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SidePanel open={!!selected} onClose={() => setSelectedId(null)}>
        {selected && (
          <EventPanelBody
            key={selected.id}
            event={selected}
            pool={pool}
            sync={eventCalendarSync}
            calendar={calendar}
            isDemoMode={isDemoMode}
            apps={apps}
            contacts={contacts}
            onContactsChanged={onRefresh}
            onClose={() => setSelectedId(null)}
          />
        )}
      </SidePanel>

      {importOpen && (
        <EventImportModal
          school={pool.school}
          poolEvents={pool.events}
          onClose={() => setImportOpen(false)}
          onCommitted={() => pool.refresh()}
        />
      )}
    </div>
  )
}
