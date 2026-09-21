-- Multi-tenant Gmail networking pipeline — per-user OAuth connection (mirrors
-- google_calendar_tokens' shape/trust model exactly: encrypted refresh token,
-- zero client-facing RLS policies, service-role only). Unlike Calendar's two fixed
-- slots ('personal'/'school'), a user can connect any number of Gmail accounts, so
-- this is keyed by (user_id, connected_email) rather than a slot enum.
create table public.gmail_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_email text not null,
  refresh_token_ciphertext text not null,
  -- { [threadId]: messageCountAlreadyProcessed } — same semantics as the Apps Script
  -- pipeline's msgcount_<threadId> PropertiesService keys, consolidated into one
  -- column per connection so re-scanning a thread never reprocesses already-seen
  -- messages or duplicates contacts/interactions/action items.
  thread_progress jsonb not null default '{}',
  -- Cooldown guard: api/gmail-scan.js skips a connection scanned more recently than
  -- ~9 minutes ago, so an external pinger firing faster than expected (or overlapping
  -- invocations) can't double-scan the same mailbox concurrently.
  last_scanned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, connected_email)
);

create index gmail_tokens_user_id_idx on public.gmail_tokens(user_id);

alter table public.gmail_tokens enable row level security;
-- Deliberately no policies — service_role only, same reasoning as google_calendar_tokens
-- and user_api_keys: the browser must never be able to read an encrypted refresh token.

create trigger gmail_tokens_set_updated_at before update on public.gmail_tokens
  for each row execute procedure public.set_updated_at();
