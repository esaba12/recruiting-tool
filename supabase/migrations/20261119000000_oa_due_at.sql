-- OA due times: the exact deadline when the invite states one ("expires Nov 21, 11:59 PM PT").
-- oa_due_date stays the day (in the user's campus zone) so every date-based view keeps working;
-- oa_due_at is null when only the day is known. Written by the Gmail scan (api/_lib/emailPipeline.js
-- oaDueFields) and editable in the application panel. The table's "all own" policy covers it.
alter table public.applications add column if not exists oa_due_at timestamptz;
