-- Interview and offer dates become fields (v1.4 spec 02).
--
-- The Gmail scan already extracted an interview date (and an invite's exact start), but only
-- used it for a push and a calendar event. These columns keep it, plus an offer's decision
-- deadline. Written by the scan (service role) and by hand in the application panel. The
-- existing "applications: all own" policy covers client reads and writes, so no RLS change.
alter table public.applications
  add column if not exists interview_at timestamptz,                         -- next scheduled interview
  add column if not exists interview_time_known boolean not null default false, -- false: date only, stored at noon campus time
  add column if not exists offer_deadline date,                              -- decision due
  add column if not exists offer_details jsonb;                              -- { base, bonus, equity, location, start, notes }
