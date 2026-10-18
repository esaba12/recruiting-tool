# 08 — Retire the Apps Script email pipeline

**Who:** 🤖. **When:** after 02 D1 (the Gmail cron) has run cleanly for a week with your
own mailbox connected. **Status:** spec only.

## Why

There are two pipelines doing the same job:

| | `scripts/email-pipeline.js` (Apps Script) | `api/gmail.js` + `api/_lib/emailPipeline.js` |
|---|---|---|
| Serves | your account only (`RECRUITING_USER_ID`) | every user, every connected mailbox |
| Size | 1,494 lines | 712 lines |
| Deploy | `clasp push`, Script Properties, triggers | git push |
| Classifier prompt | its own copy | its own copy (`INTERVIEW_VS_NETWORKING` kept in sync by hand) |

Every classifier fix lands twice, and the copies have already drifted: the serverless copy
returns a structured `interview_round` that maps to a stage, while the Apps Script copy only
mentions superdays and final rounds in its prompt text. Once your mailbox is on the serverless path,
the Apps Script copy is only a second place for bugs to hide.

## What the serverless path lacks (the work)

Each feature the Apps Script has and `api/_lib/emailPipeline.js` doesn't, roughly in order of how much it matters:

1. **Push notifications (ntfy).** Immediate pushes for OA/interview/offer/rejection, the daily
   OA digest, the daily recap, and quiet hours with a queue. Proposed: `profiles.ntfy_topic`
   (nullable, set in Settings, never logged), with a `sendPush` in `api/_lib/` that keeps the
   3× retry. Immediate pushes go out from the scan. The digest and recap run from the same cron
   tick, gated by a per-user "last digest date" in `user_settings`. No new function.
2. **Calendar invites** → spec [12](12-calendar-invites.md). VEVENT-scoped `.ics` parsing (the VTIMEZONE `DTSTART` gotcha), timing
   for real interviews, and skipping our own calendar event when an invite is attached. Port
   `extractCalendarInvite`/`parseIcsDate` as pure functions, with tests from captured `.ics` fixtures.
3. **Interview calendar event when there's no invite** (`createCalendarEvent`, with the same-day
   duplicate check and the 10h cap). Reuse `googleCalendar` server-side through the user's
   Calendar token, if one is connected.
4. **Backfill** → covered by spec [10](10-scan-budget.md): the first scan's 45-day window already is the backfill. (`runBackfillChunk`, `backfillOaCompletions`, `backfillInboxFields`). These were
   one-offs for your mailbox. For new users, an initial "scan the last 30 days" on connect,
   cursor-paged across cron ticks, is enough.
5. **Labels** (`recruiting`, `recruiting-done`). The serverless path uses `gmail.readonly`, so
   it can't label. Keep it that way: discovery already uses search queries plus a
   `last_scan_at` cursor, so the labels are no longer load-bearing.

## Cutover

1. Ship 1–3, with tests (`test/emailPipeline.test.js`).
2. Run both pipelines for a week against your mailbox. Both write `gmail_message_id` with a
   unique index (spec [11](11-interaction-dedup.md), which must land first), so the overlap is harmless. Compare the rows each one wrote.
3. Disable the Apps Script triggers (editor → clock icon); don't delete the project yet.
4. Two weeks later: delete `scripts/email-pipeline.js`, `scripts/appsscript.json`,
   `.clasp.json`/`.claspignore`, and the Apps Script sections of CLAUDE.md and the README.
   The root `package.json` keeps only the migration script.

## Done when

The Apps Script has no triggers, the classifier prompt exists once, and your pushes arrive via the serverless path.
