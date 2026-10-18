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

1. ✅ **Push notifications (ntfy)**, done 2026-10-18 on `feat/v1.3-email-parity`:
   `api/_lib/pushes.js` (tests: `test/pushes.test.js`). Update pushes (OA/interview/offer/
   rejection, only for mail under 2 days old) are queued per tick and sent as one; 22:00–08:00
   holds them; the 11am and midnight digests carry the AI recap (Sonnet, user's own key, also
   written to `daily_recaps`), open OAs and anything held. Settings → Push notifications stores
   `{ ntfyTopic, timeZone }` in `user_settings` `push_settings` (not a `profiles` column, so no
   `db push`); the queue and sent slots live in `push_state`. "Send a test" is
   `POST /api/gmail?action=test-push`. Pushes use ntfy's JSON publish: Node's fetch rejects the
   emoji titles as headers (caught by a live test against ntfy.sh).
   **Overlap:** the Apps Script still pushes to its own `NTFY_TOPIC`. Don't save a topic in
   Settings for your own account until step 3 of the cutover, or you get every push twice.
2. ✅ **Calendar invites** → spec [12](12-calendar-invites.md), done. VEVENT-scoped `.ics` parsing (the VTIMEZONE `DTSTART` gotcha), timing
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
