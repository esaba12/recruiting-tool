import { useState, useEffect, useMemo, useRef } from 'react'
import { lsGet, lsSet } from '../components/jobBoards/helpers.js'
import { findTimelineEvents } from './timelineFinder.js'
import { createEvent, addOneHour } from '../googleCalendar.js'

const META_KEY    = 'rec_timeline_meta'    // { lastCheck, hashes: { [recordKey]: contentHash } }
const PENDING_KEY = 'rec_timeline_pending' // found-but-not-yet-actioned events, keyed by event.key

const todayStr = () => new Date().toISOString().slice(0, 10)

// This hook must be called unconditionally by its caller, above any early-return gate —
// otherwise its daily-scan effect can get stuck behind a JSX-level "nothing to show"
// branch and never fire again once the caller reaches that branch. That exact failure
// mode is CR-01 (new)/Truth 1 from the phase's verification pass: when the scan trigger
// lived inside TimelineFindsPanel (a component that only mounts once there's something to
// show), a genuinely all-caught-up user permanently lost the ability to discover new
// timeline events, since the component that would run the scan never got a chance to
// mount in the first place.
export default function useTimelineFinds({ apps, calls, interactions, contacts, enabled = true, onEventCreated }) {
  const [meta, setMeta]       = useState(() => lsGet(META_KEY) || { lastCheck: null, lastRun: null, hashes: {} })
  const [pending, setPending] = useState(() => lsGet(PENDING_KEY) || [])
  const [running, setRunning] = useState(false)
  const [error, setError]     = useState(null)
  const ranRef = useRef(false)

  const contactsById = useMemo(() => new Map((contacts || []).map(c => [c.id, c])), [contacts])


  async function scan({ force = false } = {}) {
    if (running) return
    setRunning(true); setError(null)
    try {
      const { events, scannedKeys, error: partialError } = await findTimelineEvents({
        apps, calls, interactions, contactsById,
        skipHashes: force ? {} : meta.hashes,
      })
      // WR-09: merge against the FRESHEST state, not the `pending`/`meta` closed over
      // when this scan started — a dismiss()/updateField() that landed while the AI
      // call was in flight would otherwise be silently overwritten (resurrecting a
      // just-dismissed find). Functional updaters + write-through inside them.
      if (events.length) {
        setPending(prev => {
          const byKey = new Map(prev.map(p => [p.key, p]))
          for (const e of events) if (!byKey.has(e.key)) byKey.set(e.key, e)
          const next = [...byKey.values()]
          lsSet(PENDING_KEY, next)
          return next
        })
      }
      setMeta(prev => {
        const next = { lastCheck: todayStr(), lastRun: Date.now(), hashes: { ...prev.hashes, ...scannedKeys } }
        lsSet(META_KEY, next)
        return next
      })
      if (partialError) setError(partialError)
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  // Hands-off daily gate — mirrors Discover/Explore's once-per-mount background kick, now
  // additionally gated on `enabled` so callers (e.g. demo mode) can no-op the effect while
  // still calling this hook unconditionally, per the Rules of Hooks.
  useEffect(() => {
    if (!enabled) return
    if (ranRef.current) return
    ranRef.current = true
    if (meta.lastCheck !== todayStr()) scan({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  function dismiss(key) {
    setPending(prev => { const next = prev.filter(p => p.key !== key); lsSet(PENDING_KEY, next); return next })
  }

  function updateField(key, field, value) {
    setPending(prev => { const next = prev.map(p => p.key === key ? { ...p, [field]: value } : p); lsSet(PENDING_KEY, next); return next })
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
      dismiss(item.key)   // same stale-closure hazard as scan() — createEvent awaits
      onEventCreated?.()
    } catch (e) {
      updateField(item.key, 'status', null)
      setError(e.message)
    }
  }

  return { meta, pending, running, error, scan, dismiss, updateField, approve }
}
