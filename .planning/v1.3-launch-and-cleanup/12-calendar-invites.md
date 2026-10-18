# 12 — Calendar invites on the serverless Gmail path

**Who:** 🤖. **Needs from owner:** nothing. **Status:** code done (2026-10-18). Tests: `test/ics.test.js` + fixtures in `test/fixtures/ics/`. The prod check waits on 02 D1/D2. This is
[08](08-email-pipeline-consolidation.md) item 2. Item 3 (creating the calendar event) builds on it.

## Why

The Apps Script reads an attached `.ics` before classifying (`extractCalendarInvite`,
`scripts/email-pipeline.js` ~line 1446) and uses it three ways:

1. **a prompt hint**: "this email has a calendar invite… scheduled for … This proves a meeting
   is scheduled, NOT that it is an interview";
2. **the meeting link**: the invite's LOCATION/DESCRIPTION beats a regex over the body;
3. **interview timing**: for an `INTERVIEW_INVITE` only, the invite's start replaces Claude's
   guessed `interview_date`, and everything else gets `interview_date = null`.

`api/_lib/emailPipeline.js` does none of this (its header comment says so), so for users on
the serverless path, an invite-only email ("Invitation: Stripe Technical Interview @ Tue…")
gets classified from the body text alone, and the Meet link inside the invite is lost.

## Changes

1. **New `api/_lib/ics.js`**, pure functions, ported then fixed:
   - `unfoldIcs`, `icsField` (handles `NAME;PARAM=x:value`), `veventBlock`: read only the first
     `BEGIN:VEVENT…END:VEVENT`, because `VTIMEZONE`'s `DAYLIGHT`/`STANDARD` blocks carry their own
     `DTSTART` (the 1970 all-day-event bug, CLAUDE.md gotcha).
   - `parseIcsDate(value, tzid)`: `…Z` → UTC; `VALUE=DATE` → all-day date; a `TZID` value →
     convert that wall-clock time in that zone to UTC with `Intl.DateTimeFormat` offsets.
     **This is the fix:** the Apps Script treats TZID times as script-local, which works there
     but is wrong on Vercel (UTC). A floating time with no TZID is treated as UTC and flagged
     `floating: true`.
   - `parseInvite(text)` → `{ start, end, allDay, summary, location, meetingLink }` or null.
     It reuses `extractMeetingLink` from `emailPipeline.js`.
2. **Find the invite in the Gmail payload** (`findCalendarPart(payload)`): walk the MIME tree
   for a `text/calendar` part or a `*.ics` filename. Google/Outlook invites usually inline it
   (`body.data`); otherwise there's a `body.attachmentId`, fetched with
   `messages/{id}/attachments/{attId}`. Only for the **newest** message of a thread, the one
   being classified, so it's at most one extra call per thread.
3. **Wire into `scanGmailConnection`:** `meetingLink = invite?.meetingLink || extractMeetingLink(body)`.
   Add the same invite hint text as the Apps Script (keep the wording identical; both copies
   die together in 08). After classifying: non-interview → `interview_date = null`; interview
   with invite → `interview_date` from `invite.start` in the user's zone. The zone comes from
   the TZID, falling back to `America/New_York`, the same default the events code uses.
   Keep `invite` on `data` for 08 item 3.
4. **Make it visible:** for an `INTERVIEW_INVITE` with an invite, the newest message's
   interaction summary leads with `📅 <weekday, date, time tz>` (next to the existing
   meeting-link line), so Inbox and the contact timeline show when the interview is.

## Fixtures and tests first

New `test/fixtures/ics/` with real-shaped invites, personal details scrubbed (this repo is public):

- Google Calendar invite with a `VTIMEZONE` (America/New_York, DST rules) + `TZID` DTSTART;
- Outlook/Teams invite (Windows zone name like `Eastern Standard Time` → map the handful of
  US zones; unknown → floating);
- UTC `Z` invite (GoodTime/ModernLoop style);
- all-day `VALUE=DATE`;
- folded long lines (75-octet continuation) in DESCRIPTION with a Zoom link;
- garbage / no VEVENT → null.

New `test/ics.test.js`: the 1970 regression (VTIMEZONE first → the start is the real date),
TZID → correct UTC on both sides of a DST change, Windows-zone mapping, the meeting link from
LOCATION beating DESCRIPTION, and `findCalendarPart` on inline vs attachment payload shapes.
Add to `emailPipeline.test.js`: the hint text appears in the prompt when an invite is present,
and a networking-classified message with an invite ends with `interview_date: null`.

## Follow-up (2026-10-18)

The Inbox reader only recognised `📅 Meeting link:` as the *first* summary line, so with the
interview line above it the Join link vanished, and the interview time (summary only, not
`body`) never showed in the reader at all. `lib/inbox.js` `messageLead()` now splits both lead
lines off (tested against the real `interactionRow()` output in `test/inbox.test.js`), and the
reader shows "📅 Interview · <time>" next to the Join link. `/demo` has two invite threads
(Stripe screen, Morgan Stanley Superday) plus a coffee-chat invite with a link and no time.

## Checks

- `npm test && npm run build`.
- On prod after deploy (needs 02 D1/D2): forward yourself a real interview invite, and after
  the next tick the Inbox row shows the 📅 line at the right local time.

## Done when

Tests pass, and an invite email on the serverless path yields the right meeting link and, for
interviews only, the right time.
