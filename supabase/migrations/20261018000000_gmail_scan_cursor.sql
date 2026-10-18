-- Incremental Gmail discovery (v1.3 spec 10).
--
-- The scan (app/api/_lib/emailPipeline.js) used to re-search the whole 45-day window and
-- fetch every thread in it on every ~10-minute tick. scan_cursor is the start time of the
-- last *complete* pass (no budget cut, no failed thread); when it's set, searches add
-- `after:<cursor − 1h>`. NULL = never completed a pass, so the full window runs (that first
-- pass is the new-mailbox backfill).
--
-- RLS: gmail_tokens has no client policies (service-role only). Nothing changes there.

alter table public.gmail_tokens
  add column if not exists scan_cursor timestamptz;
