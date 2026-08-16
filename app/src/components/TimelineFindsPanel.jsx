import { useState, useEffect, useMemo, useRef } from 'react'
import { CalendarSearch } from 'lucide-react'
import { lsGet, lsSet, timeAgo } from './jobBoards/helpers.js'
import { findTimelineEvents } from '../lib/timelineFinder.js'
import { createEvent, addOneHour } from '../googleCalendar.js'
import { Badge, EmptyState } from '../shared.jsx'
import { AI_PROVIDER_LABEL } from '../lib/ai.js'
import Mono from './ui/Mono.jsx'

const META_KEY    = 'rec_timeline_meta'    // { lastCheck, hashes: { [recordKey]: contentHash } }
const PENDING_KEY = 'rec_timeline_pending' // found-but-not-yet-actioned events, keyed by event.key

const SOURCE_LABEL = { application: 'Application notes', call: 'Call', interaction: 'Interaction' }

const todayStr = () => new Date().toISOString().slice(0, 10)

// Runs once/day (hash-gated, so an unchanged record costs zero tokens on the next run)
// and stages any newly-found dates for review — nothing hits Google Calendar until you
// hit "+ Add to Calendar" on a specific card, same review-before-write pattern as
// AddToCalendarModal and Discover.
export default function TimelineFindsPanel({ apps, calls, interactions, contacts, onEventCreated, onPendingChange }) {
  const [meta, setMeta]       = useState(() => lsGet(META_KEY) || { lastCheck: null, lastRun: null, hashes: {} })
  const [pending, setPending] = useState(() => lsGet(PENDING_KEY) || [])
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState(null)
  const ranRef = useRef(false)

  const contactsById = useMemo(() => new Map((contacts || []).map(c => [c.id, c])), [contacts])

  useEffect(() => { onPendingChange?.(pending.length) }, [pending, onPendingChange])

  function persistMeta(next) { setMeta(next); lsSet(META_KEY, next) }
  function persistPending(next) { setPending(next); lsSet(PENDING_KEY, next) }

  async function scan({ force = false } = {}) {
    if (running) return
    setRunning(true); setError(null)
    try {
      const { events, scannedKeys, error: partialError } = await findTimelineEvents({
        apps, calls, interactions, contactsById,
        skipHashes: force ? {} : meta.hashes,
      })
      if (events.length) {
        const byKey = new Map(pending.map(p => [p.key, p]))
        for (const e of events) if (!byKey.has(e.key)) byKey.set(e.key, e)
        persistPending([...byKey.values()])
      }
      persistMeta({ lastCheck: todayStr(), lastRun: Date.now(), hashes: { ...meta.hashes, ...scannedKeys } })
      if (partialError) setError(partialError)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  // Hands-off daily gate — mirrors Discover/Explore's once-per-mount background kick.
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    if (meta.lastCheck !== todayStr()) scan({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss(key) {
    persistPending(pending.filter(p => p.key !== key))
  }

  function updateField(key, field, value) {
    persistPending(pending.map(p => p.key === key ? { ...p, [field]: value } : p))
  }

  async function approve(item) {
    updateField(item.key, 'status', 'saving')
    try {
      await createEvent({
        title: item.title,
        date: item.date,
        startTime: item.startTime || '',
        endTime: item.startTime ? addOneHour(item.startTime) : '',
        description: item.description,
      })
      persistPending(pending.filter(p => p.key !== item.key))
      onEventCreated?.()
    } catch (e) {
      updateField(item.key, 'status', null)
      setError(e.message)
    }
  }

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-accent-200">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-accent-700 mb-1 flex items-center gap-1.5">
          <CalendarSearch size={16} strokeWidth={2} />
          Timeline Finds ({pending.length}){running ? ' · scanning…' : ''}
        </h2>
        <button onClick={() => scan({ force: true })} disabled={running}
          className="shrink-0 ml-3 px-2.5 py-1 bg-white border border-accent-200 rounded-full text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
          ↻ Rescan
        </button>
      </div>

      <p className="text-xs text-ink-400 mb-3">
        Daily {AI_PROVIDER_LABEL} pass over Application notes, Calls, and Interactions for dates that aren't on your calendar yet. Nothing is created until you approve it below.
        {meta.lastRun && <> · Last scan <Mono>{timeAgo(new Date(meta.lastRun).toISOString())}</Mono></>}
      </p>

      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700 mb-2">{error}</div>}

      <div className="space-y-2">
        {pending.length === 0
          ? <EmptyState msg={running ? 'Scanning your records…' : 'Nothing pending — you’re caught up.'} />
          : pending.map(item => (
              <div key={item.key} className="bg-white rounded-lg p-3 border border-ink-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge label={SOURCE_LABEL[item.sourceType]} color="bg-indigo-50 text-indigo-600" />
                      {item.company && <span className="text-xs text-ink-500">{item.company}{item.role ? ` · ${item.role}` : ''}</span>}
                    </div>
                    <input value={item.title} onChange={e => updateField(item.key, 'title', e.target.value)}
                      className="w-full px-2 py-1 border border-ink-200 rounded-lg text-sm font-medium focus:outline-none focus:border-accent-400 mb-1.5" />
                    <div className="flex gap-2">
                      <input type="date" value={item.date} onChange={e => updateField(item.key, 'date', e.target.value)}
                        className="px-2 py-1 border border-ink-200 rounded-lg text-xs focus:outline-none focus:border-accent-400" />
                      <input type="time" value={item.startTime} onChange={e => updateField(item.key, 'startTime', e.target.value)}
                        placeholder="all-day"
                        className="px-2 py-1 border border-ink-200 rounded-lg text-xs focus:outline-none focus:border-accent-400" />
                    </div>
                    {item.description && <p className="text-[11px] text-ink-400 mt-1.5">{item.description}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button onClick={() => approve(item)} disabled={item.status === 'saving' || !item.date}
                      className="px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700 disabled:opacity-40">
                      {item.status === 'saving' ? '…' : '+ Add to Calendar'}
                    </button>
                    <button onClick={() => dismiss(item.key)}
                      className="px-2 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-400 hover:border-danger-300 hover:text-danger-600">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
