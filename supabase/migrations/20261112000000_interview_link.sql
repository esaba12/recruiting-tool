-- v1.5 spec 06: the video link for an application's next interview, so Today can show "Join".
-- Written by the Gmail scan (api/_lib/emailPipeline.js scheduleFields) from the invite's meeting
-- link, and editable in the application panel. The table's existing "all own" policy covers it.
alter table public.applications add column if not exists interview_link text;
