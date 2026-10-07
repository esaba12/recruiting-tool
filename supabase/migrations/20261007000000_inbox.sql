-- Inbox: the email pipelines (scripts/email-pipeline.js, api/_lib/emailPipeline.js) already
-- log every message of every recruiting/networking-relevant thread into `interactions`
-- (type='Email', channel_ref = Gmail thread id) and skip everything Claude classifies as
-- UNRELATED — so the filtered inbox is already in this table. These columns carry what an
-- inbox view needs that a CRM touchpoint row didn't: subject, sender, exact timestamp, which
-- mailbox it came from, the thread's classification, and per-message read state.
-- All nullable — non-email interactions (calls, LinkedIn, meetings) leave them empty, and
-- older email rows are filled by the pipeline's backfillInboxFields() where Gmail still has them.

alter table public.interactions
  add column if not exists subject text,
  add column if not exists from_address text,
  add column if not exists from_name text,
  add column if not exists sent_at timestamptz,
  add column if not exists mailbox text,          -- the connected Gmail address this came from
  add column if not exists email_category text,   -- pipeline classification: OA_INVITE, REPLY, ...
  add column if not exists read_at timestamptz;

create index if not exists interactions_user_thread_idx
  on public.interactions(user_id, channel_ref) where type = 'Email';

-- Everything logged before the inbox existed counts as already read — otherwise the first
-- open would show months of mail as unread.
update public.interactions set read_at = coalesce(read_at, created_at) where type = 'Email';

-- RLS: the existing "interactions: all own" policy (auth.uid() = user_id, all commands)
-- already covers the client marking its own rows read/unread. No policy changes.
