# 02 — One open count everywhere

**Who:** 🤖. **Migration:** none. **Depends on:** 01 (uses its `overdueFollowUps` signature).

## Why

The sidebar says **Today 19**; Today's header says **31 open**. They're two formulas:
- `TodayTab.jsx` counts what it renders: the cards and lists that are on, minus snoozed rows.
- `App.jsx` (two copies, ~line 407 and ~556) sums `overdueFollowUps + staleApplications +
  highUrgencyContacts + wantToSchedule + oaDue + oaNeedsCheck + keepInTouchDue + needsReviewApps`
  (+ action items in one copy). It misses interviews, decisions, drafted replies, thank-yous,
  awaiting reply and events, ignores the user's layout and snoozes, and uses a fixed 14-day stale
  threshold instead of the per-user setting.

A badge that disagrees with the page teaches you to ignore both.

## Changes

1. **One derivation, `lib/useTodayAttention.js`.** Move the row-building half of `TodayTab`
   (layout lookup, `trimActionItems`, `todayPeople`, `appRows`, `deriveEventAttention`,
   snooze filtering, `counts`, `openCount`) into a hook that takes `{ contacts, apps,
   interactions, actionItems, emailDrafts, eventPool, profile }` and returns `{ groups, counts,
   openCount, snoozedHidden, layout… }`. It is mounted once in `AppInner` (and `DemoApp`), like
   the other `use*.js` app-level hooks.
2. **`TodayTab` takes the hook's result as a prop** instead of deriving its own, so the page and
   the badge can't drift. Its rendering doesn't change in this spec.
3. **Badge = `openCount`.** Both `todayCount` formulas in `App.jsx` go. The badge hides at 0, as now.
4. **What counts** stays Today's current rule: rows in cards and lists that are on, minus snoozed.
   Spec 03 narrows it to Now + This week.

## Tests first

`test/todayLayout.test.js` or new `test/todayAttention.test.js` (test the pure part; keep the hook
a thin `useMemo` around an exported `deriveTodayAttention(input, layout, snoozes)`):
- A list turned off in the layout doesn't count.
- A snoozed row doesn't count; `snoozedHidden` reports it.
- `staleDays` from the layout setting is used (a 10-day-old app counts at 7, not at 14).
- Interviews, decisions, replies and thank-yous count.

## Checks

`/demo`: the sidebar number equals the header's "N open". Turn a list off in Customize and both
drop by the same amount; snooze a row and both drop by one.

## Done when

There is one number for "things to do", and it's the same in the sidebar and on Today.

## As built (2026-11-11)

- `lib/todayAttention.js` `deriveTodayAttention` (pure, takes `isSnoozed` and `now`) and
  `snoozeKey`; `lib/useTodayAttention.js` wraps it with `useTodayPrefs` + `useTodayLayout`.
- `TodayTab` takes `attention` and no longer calls the layout/prefs hooks itself (one instance,
  so Today's snoozes and Customize changes move the badge immediately). It also stopped taking
  `actionItems`, `emailDrafts` and `profile`.
- Both `todayCount` formulas in `App.jsx` are gone. `/demo`: badge 30 = header "30 open"; Clear
  all on Replies drafted → both 28.
- Tests: `test/todayAttention.test.js` (5).

