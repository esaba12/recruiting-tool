# 10 — Gmail scan budget and incremental discovery

**Who:** 🤖. **Needs from owner:** approval for one `supabase db push` (one column).
**Status:** code done on `feat/scan-budget` (2026-10-18), stacked on 11's branch; the prod checks wait on the push and 02 D1. Replaces [02](02-owner-runbook.md) D3 ("watch the load") and 08 item 4
(backfill): both turned out to be the same problem.

## Why

`handleScan` in `api/gmail.js` loops over **every** connection in one invocation, and for each
one `scanGmailConnection` (`api/_lib/emailPipeline.js`):

1. searches `in:inbox newer_than:45d` and `in:sent newer_than:30d`, up to 150 ids each;
2. calls `threads.get?format=full` for **every** thread in that window, even ones whose message
   count already matches `thread_progress`, to find out whether anything is new;
3. classifies each thread with new messages (one Anthropic call each).

So the steady state is ~300 full thread fetches per mailbox every 10 minutes, mostly to learn
nothing changed. And the **first** scan of a new mailbox classifies up to ~300 threads in one go
(the 45-day window *is* the backfill; 08 item 4 is already there by accident). At a few seconds
per classify, one new user can blow through the 300 s function limit, and when the function is
killed, nothing is saved for anyone after them in the loop.

## Changes

1. **Incremental discovery.** New column `gmail_tokens.scan_cursor timestamptz` (null = never
   completed a full pass). When it's set, both searches add `after:<cursor − 1h, unix seconds>`,
   so only threads with mail since the last complete pass come back. When it's null, the
   current 45/30-day window runs (the first-scan backfill).
   The cursor advances to the scan's *start* time only when the pass finished with no failed
   threads and no budget cut. Otherwise it stays put and the next tick retries the same window
   (`thread_progress` makes that cheap and idempotent).
2. **Time budget.** `handleScan` sets `deadline = start + 240 s` and passes it to
   `scanGmailConnection`, which checks it before each thread and returns early (`partial: true`)
   with whatever `thread_progress` it has. `handleScan` saves progress after **each**
   connection (it already does), so a cut-off run loses nothing.
3. **Per-connection cap.** At most 40 classified threads per connection per run (newest
   first: Gmail search order), so one big first scan can't starve everyone else. Fetches of
   threads with nothing new don't count against it.
4. **Fair order.** Connections sorted by `last_scanned_at` ascending, nulls first. The loop
   stops starting new connections once the deadline is near.
5. **Response.** Each result gets `partial` and `cursor` so the cron-job.org history and
   Vercel logs show when a mailbox is still catching up.

**Migration:** `supabase/migrations/20261018000000_gmail_scan_cursor.sql`, one
`add column if not exists scan_cursor timestamptz`. No RLS change (the table has no client
policies). Dry-run first, then ask before pushing. The code must tolerate the column being
null, which covers every existing row.

**Not doing:** pruning `thread_progress`. It grows ~40 bytes per thread, a few thousand
threads a year. Revisit if a row passes ~1 MB.

## Tests first (`test/emailPipeline.test.js`)

The Gmail and Anthropic calls are already behind module-level functions; inject them
(or `vi.mock` the fetch) so these run offline:

- the search query has no `after:` when `scan_cursor` is null and has `after:<cursor − 1h>` when set;
- a deadline already passed → returns `partial: true` and the untouched progress, zero classify calls;
- 60 new threads → 40 classified, `partial: true`;
- one thread throws → `cursor` doesn't advance; clean pass → advances to the start time;
- connection ordering puts null `last_scanned_at` first.

## Checks

- `npm test && npm run build`.
- After the push and deploy: `curl` the scan once by hand (02 D1's check line) and read the
  JSON for `partial`/`cursor`. On the second tick, the Vercel log duration should drop sharply
  for a mailbox that has a cursor.

## Done when

Tests pass, the column is live, and two consecutive cron ticks on prod show the cursor
advancing and sub-30 s durations for a caught-up mailbox.
