# 11 — Per-message dedup for logged emails

**Who:** 🤖. **Needs from owner:** approval for one `supabase db push`, and a `clasp push`
(🤖 can run it with approval). **Status:** open. **Must land before 02 D2** (connecting your
own Gmail to the serverless scan).

## Why

[08](08-email-pipeline-consolidation.md)'s cutover says "the serverless path dedups
interactions on `gmail_message_id`, so the overlap is harmless". It doesn't: only
`email_action_items` has that column. `interactions` rows are written by plain `insert` in both
pipelines (`logMessageInteraction` in `api/_lib/emailPipeline.js` and in
`scripts/email-pipeline.js`), and the only guard is each pipeline's own message-count map
(`thread_progress` vs the Apps Script's `msgcount_*` properties). The two maps don't know
about each other.

So the moment you do 02 D2, the first serverless scan walks 45 days of your mailbox and
re-logs every recruiting thread the Apps Script already logged: duplicate rows in Inbox,
Network timelines, Today's "last point of contact", and the networking-flow counts.

## Changes

1. **Migration** `supabase/migrations/20261018010000_interactions_gmail_message_id.sql`:
   `alter table interactions add column if not exists gmail_message_id text`, plus a plain
   (non-partial) unique index on `(user_id, gmail_message_id)`. NULLs are distinct, so calls
   and LinkedIn rows never collide. It can't be a partial index: PostgREST's `on_conflict`
   can't name the index predicate, so `ON CONFLICT` wouldn't match it. No RLS change (the
   existing "all own" policy covers it). Dry-run, then ask before pushing.
2. **Serverless writer.** `logMessageInteraction` sets `gmail_message_id: message.id` and
   upserts with `onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true`.
3. **Legacy rows** (written before the column existed, so it's null). Before logging a
   thread's messages, one query: `interactions` rows for `(user_id, channel_ref = threadId,
   type = 'Email')` (indexed: `interactions_user_thread_idx`). Skip any message whose `sent_at`
   is within 5 s of an existing row's `sent_at`. That covers the Apps Script's history, whose
   `sent_at` comes from the same Gmail message date. Pure helper `isAlreadyLogged(existing, message)`.
4. **Apps Script writer.** `scripts/email-pipeline.js` `logMessageInteraction` also writes
   `gmail_message_id: message.getId()` (GmailApp and the REST API share message ids) and adds
   `Prefer: resolution=ignore-duplicates` with `on_conflict=user_id,gmail_message_id` to its
   PostgREST insert. Then `clasp push` (clone first if it says "Skipping push").
5. **Fix 08's text** so it no longer claims the dedup already existed.

## Tests first (`test/emailPipeline.test.js`)

- `isAlreadyLogged`: exact `sent_at` match, 4 s apart (skip), 10 s apart (keep), no rows (keep).
- `logMessageInteraction` payload includes `gmail_message_id` and the upsert options
  (assert on a mocked `db.from().upsert`).
- The live RLS suite (`test/rls.test.js`) still passes after the push: user A can't read or
  collide with user B's `gmail_message_id`.

## Checks

- `npm test && npm run build`.
- After push and deploy: run the scan by hand twice for one connected mailbox. The interaction
  count for that user doesn't change on the second run.
- After 02 D2: pick three threads the Apps Script logged last week and confirm each still has one
  row per message in Inbox.

## Done when

Both pipelines write `gmail_message_id`, the index is live, and connecting your own Gmail
creates no duplicate rows.
