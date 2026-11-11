# 06 — Interview rows: prep, join link, morning push

**Who:** 🤖; 👤 approves the db push. **Migration:** `applications.interview_link text`.
**Depends on:** 03.

## Why

Interviews are the highest-stakes items in the season, and their Today row only opens the
application. The things you need are elsewhere: company prep is in Learn (`CompanyPrepWidget`),
the meeting link is buried in an interaction summary ("📅 Meeting link: …", written by
`interactionRow` in `api/_lib/emailPipeline.js`) or a calendar event, and the morning digest
push covers OAs and offers but not interviews.

## Changes

1. **Migration** `20261112000000_interview_link.sql`: `alter table applications add column if
   not exists interview_link text;` No policy change (the table's `all own` policy covers it).
   **Ask before `supabase db push`.** Apps Script doesn't select the column, so no `clasp push`.
2. **Server:** `scheduleFields` writes `interview_link` alongside `interview_at` when the
   classified email has a `meetingLink`; a later email with a new link for the same interview
   replaces it. `db.js` maps `interviewLink`; the application panel's Next Interview fields get a
   "Join link" input.
3. **Calendar fallback:** `normalizeEvent` in `src/googleCalendar.js` adds `meetLink`
   (`item.hangoutLink`, else the `conferenceData.entryPoints` video `uri`, else a Zoom/Meet/Teams
   URL found in `location`/`description`). Pure `interviewJoinLink(app, calendarEvents)` in
   `lib/attention.js`: `app.interviewLink`, else a calendar event within ±2h of `interviewAt`
   whose title contains the company (`normalizeCompanyName`).
4. **Queue row** (`interview` kind): primary **Prep** opens Learn on that company's prep (add a
   `focusCompany` prop to `LearnTab` / an `onOpenPrep(company)` handler if no deep link exists),
   secondary **Join ↗** when a link is known, shown in the accent tone from 30 minutes before
   start. Reason text: "in 2d · Fri 2:00 PM", or "today 2:00 PM" in Now.
5. **Morning push:** `api/_lib/pushes.js` `buildDigest` gets `interviews` (today's, with time
   and join link). Pure `interviewDigest(apps, today)` beside `oaDigest`/`offerDigest`. The
   digest's click URL opens Today.
6. **`/demo`:** give the Anthropic interview a `interviewLink` so Join renders; leave Morgan
   Stanley without one to show the no-link case.

## Tests first

- `test/interviewEvent.test.js`: `scheduleFields` writes the link with the time; doesn't clear a
  stored link when an email has none.
- `interviewJoinLink`: stored link wins; calendar match by company and ±2h; no match → null.
- `normalizeEvent`: `hangoutLink`, `conferenceData`, and a Zoom URL in `location`.
- `test/pushes.test.js`: `interviewDigest` lists today's interviews only, sorted by time.

## Checks

`/demo`: the Anthropic row shows Prep and Join; Prep lands on Anthropic in Learn. Live (owner):
an interview invite email with a Meet link produces a Join button after the next scan, and the
next morning digest lists it.

## Done when

On interview day, Today has the time, the link and your prep one click away, and your phone
told you about it that morning.
