-- Per-message dedup for logged emails (v1.3 spec 11).
--
-- Both email pipelines (scripts/email-pipeline.js and app/api/_lib/emailPipeline.js) log every
-- message of a relevant thread into `interactions`, and each only remembers what *it* has
-- logged (Script Properties vs gmail_tokens.thread_progress). Once one mailbox is scanned by
-- both, the same Gmail message would be inserted twice. Gmail message ids are the same in
-- GmailApp and the REST API, so both writers now set this column and insert with
-- `on conflict (user_id, gmail_message_id) do nothing`.
--
-- A plain (not partial) unique index on purpose: PostgREST's on_conflict can't name an index
-- predicate, so ON CONFLICT wouldn't match a partial one. NULLs are distinct, so calls,
-- LinkedIn rows and pre-existing email rows (all NULL here) never collide.
--
-- RLS: the existing "interactions: all own" policy covers the new column. No policy changes.

alter table public.interactions
  add column if not exists gmail_message_id text;

create unique index if not exists interactions_user_gmail_message_idx
  on public.interactions(user_id, gmail_message_id);
