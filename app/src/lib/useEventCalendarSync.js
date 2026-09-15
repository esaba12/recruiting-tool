import { useState, useEffect, useRef, useCallback } from 'react'
import { getUserSetting, setUserSetting } from '../db.js'
import { ensureRecruitingCalendar } from '../googleCalendar.js'
import { getGoogleCalendarStatus } from './googleAuth.js'
import { pushEvent, unpushEvent, reconcile, shouldAutoPush, needsPush } from './eventCalendarSync.js'

export const SYNC_SETTING_KEY = 'recruiting_calendar_sync'   // { enabled: bool, slot: 'personal'|'school' }
export const DEFAULT_SYNC = { enabled: true, slot: 'personal' }
const MAX_AUTO_PUSH_PER_RUN = 8

// Drives Recruiting Events ↔ Google Calendar sync for the signed-in user:
//   • reads the sync preference (enabled + which slot owns the Recruiting calendar)
//   • checks that slot consented to calendar.app.created (else `needsReconnect`)
//   • ensures the dedicated calendar exists, once per session
//   • reconciles Google-side deletes (nulls ids, keeps rows) once per session
//   • auto-pushes relevance-high events that aren't on the calendar yet, and
//     re-pushes synced events whose pool row changed since the last sync
// Exposes push/unpush for the UI's manual toggle. All writes go through
// pool.updateUserEvent so the pool's state stays the single source of truth.
export default function useEventCalendarSync({ pool, enabled = true } = {}) {
  const [setting, setSetting] = useState(null)          // null until loaded
  const [status, setStatus] = useState({ connected: false, canManageCalendars: false })
  const [calendarId, setCalendarId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const reconciledRef = useRef(false)
  const autoPushedRef = useRef(new Set())

  useEffect(() => {
    if (!enabled) return
    getUserSetting(SYNC_SETTING_KEY).then(v => setSetting({ ...DEFAULT_SYNC, ...(v || {}) })).catch(() => setSetting(DEFAULT_SYNC))
  }, [enabled])

  const slot = setting?.slot || DEFAULT_SYNC.slot
  useEffect(() => {
    if (!enabled || !setting) return
    getGoogleCalendarStatus(slot).then(setStatus).catch(() => setStatus({ connected: false, canManageCalendars: false }))
  }, [enabled, setting, slot])

  const ready = enabled && !!setting?.enabled && status.canManageCalendars
  const needsReconnect = enabled && !!setting?.enabled && status.connected && !status.canManageCalendars

  useEffect(() => {
    if (!ready || calendarId) return
    ensureRecruitingCalendar(slot).then(setCalendarId).catch(e => setError(e.message))
  }, [ready, slot, calendarId])

  const push = useCallback(async (event) => {
    if (!calendarId) throw new Error('Recruiting calendar not ready')
    const userEvent = pool.userEventsById.get(event.id)
    const fields = await pushEvent({ event, userEvent, completions: pool.completions, slot, calendarId })
    return pool.updateUserEvent(event.id, fields)
  }, [calendarId, slot, pool])

  const unpush = useCallback(async (event) => {
    const userEvent = pool.userEventsById.get(event.id)
    if (!userEvent?.calendarEventId && !Object.keys(userEvent?.calendarReminderIds || {}).length) return userEvent
    const fields = await unpushEvent({ userEvent, slot: userEvent.calendarSlot || slot, calendarId })
    return pool.updateUserEvent(event.id, fields)
  }, [calendarId, slot, pool])

  // Reconcile once per session, then auto-push / re-push.
  useEffect(() => {
    if (!ready || !calendarId || pool.loading || syncing) return
    let cancelled = false
    ;(async () => {
      setSyncing(true)
      try {
        if (!reconciledRef.current) {
          reconciledRef.current = true
          const patches = await reconcile({ userEvents: pool.userEvents, slot, calendarId })
          for (const p of patches) if (!cancelled) await pool.updateUserEvent(p.eventId, p.patch)
        }
        let budget = MAX_AUTO_PUSH_PER_RUN
        for (const ev of pool.events) {
          if (cancelled || budget <= 0) break
          const ue = pool.userEventsById.get(ev.id)
          const synced = !!ue?.calendarEventId
          const changedSince = synced && needsPush(ev, { userEvent: ue, completions: pool.completions })
          const wantsAuto = !synced && shouldAutoPush(ev, { tier: pool.tierOf(ev), userEvent: ue }) && !autoPushedRef.current.has(ev.id)
          if (!changedSince && !wantsAuto) continue
          autoPushedRef.current.add(ev.id)
          await push(ev); budget--
        }
      } catch (e) { if (!cancelled) setError(e.message) }
      finally { if (!cancelled) setSyncing(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, calendarId, pool.loading, pool.events, pool.userEvents])

  async function updateSetting(next) {
    const merged = { ...DEFAULT_SYNC, ...(setting || {}), ...next }
    setSetting(merged)
    setCalendarId(null); reconciledRef.current = false
    await setUserSetting(SYNC_SETTING_KEY, merged)
  }

  return { setting, updateSetting, slot, status, calendarId, ready, needsReconnect, syncing, error, push, unpush }
}
