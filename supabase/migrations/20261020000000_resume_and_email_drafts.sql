-- Résumé in onboarding (v1.4 spec 09) + auto-drafted email replies (v1.4 spec 10).
--
-- 1. profiles.resume_text — the text of the user's résumé, extracted from a PDF in the browser
--    (or pasted). Only the text is kept; there is no file storage. Read by client drafting
--    (lib/drafting.js) and the server reply drafter (api/_lib/replyDraft.js). The existing
--    "profiles: update own" policy covers writes.
alter table public.profiles
  add column if not exists resume_text text,
  add column if not exists resume_updated_at timestamptz;

-- 2. email_drafts — one suggested reply per inbound Gmail message that needs an answer,
-- written by the Gmail scan (service role) and read/edited/dismissed in Inbox and Today.
-- Unique per (user_id, reply_to_message_id) so a re-scanned thread updates its draft instead
-- of adding a second one. gmail_draft_id is reserved for writing real Gmail drafts later
-- (gmail.compose); nothing sets it yet.
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mailbox text,
  thread_id text not null,
  reply_to_message_id text not null,
  to_address text,
  subject text,
  body text not null,
  intent text,                             -- schedule_call | answer | confirm | thank | other
  proposed_slots jsonb,                    -- [{ start, end }] ISO strings, null when none
  slots_checked boolean not null default false, -- slots were checked against a connected calendar
  status text not null default 'pending',  -- pending | done | dismissed
  gmail_draft_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reply_to_message_id)
);

create index email_drafts_user_pending_idx on public.email_drafts(user_id) where status = 'pending';

-- Read, edit and dismiss your own drafts. No insert policy: only the service-role scan writes them.
alter table public.email_drafts enable row level security;
create policy "email_drafts: read own" on public.email_drafts
  for select using (auth.uid() = user_id);
create policy "email_drafts: update own" on public.email_drafts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "email_drafts: delete own" on public.email_drafts
  for delete using (auth.uid() = user_id);
