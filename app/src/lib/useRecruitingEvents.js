import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  fetchSchoolEvents, fetchEmployers, fetchIngestSources, fetchMyEventState,
  upsertUserEvent, upsertEventRelevance, upsertEventRelevanceMany, setRequirementCompletion,
} from '../db.js'
import { lsGet, lsSet } from './scopedStorage.js'
import { todayStr } from './ingest/scheduler.js'
import { needsAttributes, needsDeadlineCheck, runEventEnrichment } from './eventEnrichment.js'
import { computeRelevance, effectiveTier, sortByRelevance } from './eventRelevance.js'
import { canSetStatus } from './eventRequirements.js'

const ENRICH_META_KEY = 'rec_events_enrich_meta'   // { lastCheck } — per-browser daily gate for the enrichment pass

// The Recruiting Events pool as one hook: shared rows (events + attributes +
// requirements, employers, source health) plus the caller's private overlay
// (status/notes, relevance, completions). Runs the once-per-event enrichment
// pass when it finds un-enriched events (server-side content_hash means this is
// idempotent across users), recomputes relevance whenever its inputs change
// and persists only the rows whose input hash moved.
//
// `enabled=false` (demo mode, or no campus yet) no-ops every effect while the
// hook is still called unconditionally, per the Rules of Hooks.
export default function useRecruitingEvents({ enabled = true, profile, targets = [], contacts = [], apps = [], isDemo = false, refreshKey = 0 } = {}) {
  const [events, setEvents] = useState([])
  const [employers, setEmployers] = useState([])
  const [sources, setSources] = useState([])
  const [myState, setMyState] = useState({ userEvents: [], relevance: [], completions: [] })
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [error, setError] = useState(null)
  const enrichedRef = useRef(false)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true); setError(null)
    try {
      const [ev, emp, src, mine] = await Promise.all([fetchSchoolEvents(), fetchEmployers(), fetchIngestSources(), fetchMyEventState()])
      setEvents(ev); setEmployers(emp); setSources(src); setMyState(mine)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [enabled])

  useEffect(() => { load() }, [load, refreshKey])

  // Enrichment pass: once per browser per day, and only if something actually needs it.
  useEffect(() => {
    if (!enabled || isDemo || loading || enrichedRef.current) return
    if (!events.some(e => needsAttributes(e) || needsDeadlineCheck(e))) return
    const meta = lsGet(ENRICH_META_KEY) || {}
    if (meta.lastCheck === todayStr()) return
    enrichedRef.current = true
    setEnriching(true)
    runEventEnrichment(events)
      .then(r => { if (r.error) setError(r.error); lsSet(ENRICH_META_KEY, { lastCheck: todayStr(), last: r }); return load() })
      .catch(e => setError(e.message))
      .finally(() => setEnriching(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isDemo, loading, events])

  // Relevance: pure recompute; persist only changed rows.
  const ctx = useMemo(() => ({ profile, targets, contacts, apps, employers, now: Date.now() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.focus, targets, contacts, apps, employers])
  const { view: relevanceView, writes } = useMemo(() => computeRelevance(events, ctx, myState.relevance), [events, ctx, myState.relevance])
  useEffect(() => {
    if (!enabled || !writes.length) return
    let cancelled = false
    upsertEventRelevanceMany(writes)
      .then(() => { if (cancelled) return; setMyState(prev => {
        const byId = new Map(prev.relevance.map(r => [r.eventId, r]))
        for (const w of writes) byId.set(w.eventId, { ...(byId.get(w.eventId) || {}), ...w })
        return { ...prev, relevance: [...byId.values()] }
      }) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [enabled, writes])

  const userEventsById = useMemo(() => new Map(myState.userEvents.map(u => [u.eventId, u])), [myState.userEvents])
  const sorted = useMemo(() => sortByRelevance(events, relevanceView), [events, relevanceView])

  // ── actions (functional state updates — same WR-09 discipline as useTimelineFinds) ──
  async function setStatus(eventId, status) {
    const ev = events.find(e => e.id === eventId)
    if (!canSetStatus(status, ev?.requirements || [], myState.completions)) {
      throw new Error('Complete every required signup step before marking this confirmed.')
    }
    const row = await upsertUserEvent(eventId, { status })
    setMyState(prev => ({ ...prev, userEvents: [...prev.userEvents.filter(u => u.eventId !== eventId), row] }))
    return row
  }

  async function updateUserEvent(eventId, fields) {
    const row = await upsertUserEvent(eventId, fields)
    setMyState(prev => ({ ...prev, userEvents: [...prev.userEvents.filter(u => u.eventId !== eventId), row] }))
    return row
  }

  async function toggleRequirement(requirementId, completed) {
    await setRequirementCompletion(requirementId, completed)
    setMyState(prev => ({
      ...prev,
      completions: completed
        ? [...prev.completions.filter(c => c.requirementId !== requirementId), { requirementId, completedAt: new Date().toISOString() }]
        : prev.completions.filter(c => c.requirementId !== requirementId),
    }))
  }

  async function setOverride(eventId, overrideTier) {
    const row = await upsertEventRelevance(eventId, { overrideTier: overrideTier || null })
    setMyState(prev => ({ ...prev, relevance: [...prev.relevance.filter(r => r.eventId !== eventId), row] }))
  }

  async function dismiss(eventId, dismissed = true) {
    const row = await upsertEventRelevance(eventId, { dismissedAt: dismissed ? new Date().toISOString() : null })
    setMyState(prev => ({ ...prev, relevance: [...prev.relevance.filter(r => r.eventId !== eventId), row] }))
  }

  return {
    events: sorted, employers, sources, userEvents: myState.userEvents, completions: myState.completions,
    relevance: relevanceView, tierOf: ev => effectiveTier(relevanceView.get(ev.id)), userEventsById,
    loading, enriching, error, refresh: load,
    setStatus, updateUserEvent, toggleRequirement, setOverride, dismiss,
  }
}
