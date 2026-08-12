-- Online Assessment (OA) tracking: due date + link extracted by the email pipeline,
-- with a checked-at marker so the client-side research fallback (lib/oaResearch.js)
-- only re-attempts a page read on a cooldown rather than every load.
alter table public.applications
  add column oa_due_date date,
  add column oa_link text,
  add column oa_completed boolean not null default false,
  add column oa_research_checked_at timestamptz;
