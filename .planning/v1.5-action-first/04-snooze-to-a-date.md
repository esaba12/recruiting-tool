# 04 — Snooze to a date

**Who:** 🤖. **Migration:** none (`user_settings.today_prefs.snoozed` already stores an
`untilMs` per key). **Depends on:** 03 (the queue's ✕).

## Why

Every ✕ hides a row for exactly 7 days (`SNOOZE_DAYS` in `lib/useTodayPrefs.js`). Real deferrals
are "tomorrow morning", "Monday", or "after Friday's interview". Seven days is too long for a
follow-up you meant to send tomorrow and too short for keep-in-touch, so people either leave
rows sitting there or lose them.

## Changes

1. **`useTodayPrefs`:** add `snoozeUntil(keys, untilMs)`; `snooze(keys, days)` stays (Clear all
   uses it).
2. **Pure `lib/snoozeOptions.js` `snoozeOptions(item, { now, timeZone })`** returns the menu:
   - **Tomorrow** (8:00 local next day)
   - **Monday** (8:00 local; hidden on Sunday, where it equals Tomorrow)
   - **Next week** (7 days, the old behavior)
   - **After the interview** (when the item's application has a future `interviewAt`:
     interview + 1 day, 8:00) or **After the deadline** (offer/OA/event with a future due date)
3. **The queue's ✕** opens a small popover with those options (keyboard: arrows + Enter, Esc
   closes). A plain click on the row's ✕ icon with no choice made keeps the current 7-day
   default, so the fast path stays one click.
4. **Unhide** in the header lists what's snoozed with each return date ("Amara Osei · back Mon"),
   each with "Unhide", plus "Unhide all".
5. **Snooze ends early when the item changes:** a snooze stores the item's `due` at snooze time
   (`{ until, due }`); if the item's due date moves (new OA deadline, rescheduled interview), it
   shows again. Old `{ key: untilMs }` values keep working.

## Tests first

`test/snoozeOptions.test.js`: Tomorrow/Monday at 8:00 local across a DST change and a Sunday;
"After the interview" only with a future `interviewAt`; options order. `useTodayPrefs` pure
part: legacy number values read as `until`; a changed `due` un-snoozes.

## Checks

`/demo`: snooze Amara "Tomorrow", the Unhide list says "back Thu" (or the right day), Unhide
brings her back. Keyboard-only through the popover. 390px: the popover stays on screen.

## Done when

You can put any row away until the moment it matters again, in two clicks.

## As built (2026-11-11)

- `lib/snooze.js` (`snoozeOptions`, `snoozeActive`, `snoozeEntry`, `dueOf`, `backLabel`);
  `useTodayPrefs` gained `snoozeUntil`, `unsnooze` and `untilOf`. `deriveTodayAttention` returns
  `hidden` (key, list, row) for the Unhide list.
- **One control, not two:** the queue row's ✕ became a clock that opens the menu (two clicks for
  any choice, Next week included), instead of ✕ = 7 days plus a separate menu. One hover target
  per row reads cleaner, and every option is two clicks either way. Old opt-in cards keep ✕ = 7 days.
- `/demo`: HRT OA → Tomorrow (keyboard: Enter on the focused first option) → gone, badge 19 → 18,
  Unhide shows "back tomorrow"; Unhide → back, 19.
- Tests: `test/snooze.test.js` (10).

