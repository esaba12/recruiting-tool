import { useMemo } from 'react'
import useTodayPrefs from './useTodayPrefs.js'
import useTodayLayout from './useTodayLayout.js'
import { layoutContext } from './todayCards.js'
import { deriveTodayAttention } from './todayAttention.js'

// Mounted once in AppInner / DemoApp (v1.5 spec 02): the layout, snoozes and derived lists
// that Today renders and the sidebar badge counts. One instance, so a snooze or a layout change
// on Today moves the badge too.
export default function useTodayAttention({ contacts, apps, interactions, actionItems, emailDrafts, eventPool, profile }) {
  const prefs = useTodayPrefs()
  const school = eventPool?.school
  const ctx = useMemo(() => layoutContext(profile, school), [profile, school])
  const { layout, update, reset, customized } = useTodayLayout(ctx)
  const derived = useMemo(
    () => deriveTodayAttention({ contacts, apps, interactions, actionItems, emailDrafts, eventPool }, { layout, ctx, isSnoozed: prefs.isSnoozed }),
    [contacts, apps, interactions, actionItems, emailDrafts, eventPool, layout, ctx, prefs.isSnoozed],
  )
  return { ...derived, prefs, ctx, layout, update, reset, customized }
}
