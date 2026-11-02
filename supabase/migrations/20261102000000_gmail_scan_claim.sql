-- Per-mailbox scan claim (2026-11-02).
--
-- The scan (app/api/gmail.js) sets scan_claimed_at with one conditional update before it
-- touches a mailbox, and clears it when it saves the result. Another run that finds a claim
-- younger than 300 s (the function limit) skips that mailbox, so overlapping runs (a slow cron
-- tick, a manual test run, "Scan now") don't share Gmail's per-user quota and hit 403s.
-- An older claim belongs to a run that died and is taken over.
--
-- RLS: gmail_tokens has no client policies (service-role only). Nothing changes there.

alter table public.gmail_tokens
  add column if not exists scan_claimed_at timestamptz;
