import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getUserSetting, setUserSetting } from '../db.js'
import { defaultLayout, reconcileLayout } from './todayCards.js'

// Today's card layout (v1.4 spec 08), in user_settings under its own key so it follows the user
// across devices and never overwrites today_prefs' snoozes. Nothing is stored until the user
// changes something, so an account that never presses Customize keeps getting the default (and
// any registry change to it). Writes are optimistic, like useTodayPrefs.
const KEY = 'today_layout'

export default function useTodayLayout(ctx) {
  const [saved, setSaved] = useState(null)
  const latest = useRef(null)

  useEffect(() => {
    let alive = true
    getUserSetting(KEY).then(v => {
      if (!alive || !v) return
      latest.current = v
      setSaved(v)
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const layout = useMemo(() => reconcileLayout(saved, ctx), [saved, ctx])

  // fn: layout → layout, from lib/todayCards.js's reducers.
  const update = useCallback(fn => {
    const next = fn(reconcileLayout(latest.current, ctx))
    latest.current = next
    setSaved(next)
    setUserSetting(KEY, next).catch(() => {})
  }, [ctx])

  const reset = useCallback(() => update(() => defaultLayout(ctx)), [update, ctx])

  return { layout, update, reset, customized: saved !== null }
}
