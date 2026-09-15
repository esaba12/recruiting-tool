-- Recruiting Events — calendar extension.
--   google_calendar_tokens.scopes: the scope string Google actually granted for the
--     slot, so the app knows whether calendar.app.created (dedicated "Recruiting"
--     calendar) is available or the user needs to reconnect. Server-only table, as before.
--   user_events.calendar_reminder_ids: Google event ids of the per-requirement /
--     follow-up reminder events pushed alongside the main event, keyed by
--     "req:<requirement_id>" / "followup", so in-app deletes can remove them and a
--     Google-side delete can null just that key rather than destroying our row.
alter table public.google_calendar_tokens add column scopes text;
alter table public.user_events add column calendar_reminder_ids jsonb not null default '{}'::jsonb;
--   user_events.calendar_sync_hash: hash of the last body pushed to Google, so a daily
--     feed re-verification (which bumps events.updated_at) doesn't trigger a PATCH
--     unless something the calendar can see actually changed.
alter table public.user_events add column calendar_sync_hash text;
