-- Support connecting more than one Google Calendar account per user (e.g. a "personal"
-- Gmail account and a separate "school" Google Workspace account) instead of exactly one.
-- Additive + backward compatible: existing rows get slot='personal' via the column
-- default, so anyone already connected keeps working without reconnecting.
alter table public.google_calendar_tokens add column slot text not null default 'personal';
alter table public.google_calendar_tokens drop constraint google_calendar_tokens_pkey;
alter table public.google_calendar_tokens add constraint google_calendar_tokens_pkey primary key (user_id, slot);
