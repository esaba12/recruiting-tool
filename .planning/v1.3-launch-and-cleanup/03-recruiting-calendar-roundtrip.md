# 03 — Recruiting calendar live round trip

**Who:** owner reconnects; 🤖 can drive the checks in the browser and read the DB afterwards.
**Blocked on:** 02 A1 (`calendar.app.created` on the consent screen).
**Why:** v1.1 phase 11 was verified against mocks and the allowlist tests, but nothing has yet
created a real calendar on a real Google account. It's the one v1.1 claim nobody has observed.
(Moved here from the archived `.planning/archive/v1.1-HANDOFF.md` → "Manual steps".)

## Setup

1. Prod is on `main` with v1.1 merged. It is: PR #11, deployed 2026-10-16.
2. Settings → Google Calendar → Personal → **Disconnect**, then **Connect**. Grants from before
   phase 11 lack `calendar.app.created`. Settings shows "⚠ Reconnect" until you redo it.
3. Settings → Recruiting calendar → sync **on**, slot Personal.

## Checks

| # | Do | Expect | How to verify |
|---|----|--------|---------------|
| 1 | Open the app (any tab) | `ensureRecruitingCalendar` creates a calendar named "Recruiting" | It shows in Google Calendar's sidebar; `user_settings` has `recruiting_calendar_id:personal` |
| 2 | Wait for one auto-push (or mark an event Going) | The relevance-high event and one reminder per required step with a `due_at` land on the Recruiting calendar, **not** primary | Google UI; `user_events.calendar_event_id` and `calendar_reminder_ids` are set |
| 3 | Reload | No re-PATCH of unchanged events | Network tab: no `PATCH .../events/` requests (the `calendar_sync_hash` gate) |
| 4 | Delete the pushed event in Google, then reload the app | `reconcile()` nulls `calendar_event_id` and **keeps** the `user_events` row (status and notes intact) | SQL: `select status, notes, calendar_event_id from user_events where event_id = …` |
| 5 | Calendar → Grid: create an event, then delete it | Feed updates without a reload (CR-02) | Visually, both ways |

Also confirm the proxy refuses calendar deletion: `DELETE /google-calendar?path=calendar/v3/calendars/<id>&slot=personal`
with the session's Bearer token → 403 (`api/_lib/calendarAllowlist.js`; also covered by `test/calendarAllowlist.test.js`).

## If something fails

- 403 on `calendars` POST → the scope isn't in the grant. Check `google_calendar_tokens.scopes` for that slot; reconnect.
- Nothing pushes at all → `ensureRecruitingCalendar` threw; `useEventCalendarSync` keeps it in its `error` state; log it from there. There's no fallback to primary by design.
- Write any fix as a normal commit and add a test to `test/eventCalendarSync.test.js` that reproduces it.

## Done when

All five checks pass. Then add a "verified live <date>" line to `docs/architecture/recruiting-events.md` → Calendar extension, and mark 03 done in the README.
