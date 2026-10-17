import { useCallback, useEffect, useRef, useState } from 'react'
import { getUserSetting, setUserSetting } from '../db.js'

// Today's declutter state, in user_settings under one key so it follows the user across
// devices: { snoozed: { '<section>:<id>': untilMs }, collapsed: ['<section>', …] }.
// Snoozes past their time are pruned on load. Writes are optimistic; a failed save just
// leaves the local state in place for this session.
const KEY = 'today_prefs'
export const SNOOZE_DAYS = 7

export default function useTodayPrefs() {
  const [prefs, setPrefs] = useState({ snoozed: {}, collapsed: [] })
  const latest = useRef(prefs)

  useEffect(() => {
    let alive = true
    getUserSetting(KEY).then(v => {
      if (!alive || !v) return
      const now = Date.now()
      const snoozed = Object.fromEntries(Object.entries(v.snoozed || {}).filter(([, until]) => until > now))
      const next = { snoozed, collapsed: v.collapsed || [] }
      latest.current = next
      setPrefs(next)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const save = useCallback(fn => {
    const next = fn(latest.current)
    latest.current = next
    setPrefs(next)
    setUserSetting(KEY, next).catch(() => {})
  }, [])

  const isSnoozed = useCallback((key) => (prefs.snoozed[key] || 0) > Date.now(), [prefs])

  const snooze = useCallback((keys, days = SNOOZE_DAYS) => {
    const until = Date.now() + days * 86400000
    save(p => ({ ...p, snoozed: { ...p.snoozed, ...Object.fromEntries(keys.map(k => [k, until])) } }))
  }, [save])

  const clearSnoozes = useCallback(() => save(p => ({ ...p, snoozed: {} })), [save])

  const toggleCollapsed = useCallback((id) => {
    save(p => ({ ...p, collapsed: p.collapsed.includes(id) ? p.collapsed.filter(x => x !== id) : [...p.collapsed, id] }))
  }, [save])

  const setAllCollapsed = useCallback((ids) => save(p => ({ ...p, collapsed: ids })), [save])

  return {
    isSnoozed, snooze, clearSnoozes,
    snoozedCount: Object.keys(prefs.snoozed).length,
    isCollapsed: id => prefs.collapsed.includes(id),
    collapsed: prefs.collapsed,
    toggleCollapsed, setAllCollapsed,
  }
}
