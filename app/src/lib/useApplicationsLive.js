import { useEffect, useRef } from 'react'
import { supabase } from './supabaseClient.js'

// Keeps `apps` current while the app is open: the email pipeline (service role) and other
// tabs/devices write applications + application_stage_events, and Supabase Realtime
// pushes those rows (both tables are in the supabase_realtime publication — see
// 20261016000000_application_stage_events.sql; RLS still decides who receives what).
// Bursts collapse into one quiet refresh. Also refreshes on tab re-focus, which covers
// a dropped socket or a CSP that blocks wss.
export default function useApplicationsLive({ userId, enabled = true, onChange, debounceMs = 1200 }) {
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    if (!enabled || !userId) return
    let timer = null
    const kick = () => {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current?.(), debounceMs)
    }
    const filter = `user_id=eq.${userId}`
    const channel = supabase
      .channel(`applications-live:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications', filter }, kick)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'application_stage_events', filter }, kick)
      .subscribe()

    let hiddenAt = 0
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > 60_000) kick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
      supabase.removeChannel(channel)
    }
  }, [userId, enabled, debounceMs])
}
