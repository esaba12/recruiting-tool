-- AI-driven todolist/recap feature (see .planning — email pipeline discovery/classification
-- rewrite) + "follow up via text" button.
--
-- 1. contacts.phone — no phone field existed anywhere in the schema. Needed for the new
--    sms: quick-link/draft-and-text flow, and opportunistically extracted from email
--    signatures by the pipeline the same way referrer_name already is.
alter table public.contacts add column phone text;

-- 2. email_action_items — one row per processed email message that implies a concrete next
-- step ("reply to Jane about Tuesday's call"), emitted by the email pipeline's classification
-- call alongside (not instead of) the existing contacts/applications/interactions writes.
-- Unique per (user_id, gmail_message_id) so re-processing a thread never duplicates a row.
create table public.email_action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  gmail_message_id text not null,
  thread_id text,
  contact_id uuid references public.contacts(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  summary text not null,
  priority text not null default 'medium',   -- 'high' | 'medium' | 'low'
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  dismissed_at timestamptz,
  unique (user_id, gmail_message_id)
);

create index email_action_items_user_id_idx on public.email_action_items(user_id)
  where completed_at is null and dismissed_at is null;

alter table public.email_action_items enable row level security;
create policy "email_action_items: all own" on public.email_action_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. daily_recaps — one row per user per day, written by the pipeline's new daily
-- generateDailyRecap() trigger and read by TodayTab's in-app recap card. todo_json mirrors
-- the same prioritized list pushed via ntfy, so the in-app card and the push notification
-- always show the same content.
create table public.daily_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  summary_text text not null,
  todo_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_recaps enable row level security;
create policy "daily_recaps: all own" on public.daily_recaps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
