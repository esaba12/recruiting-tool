-- Multi-track profile (v1.2 spec 01).
--
-- `focus` ('SWE' | 'PM' | 'Both') couldn't express finance/quant/consulting
-- recruiting. `tracks` replaces it as a multi-select; `focus` stays as a
-- read-only legacy column (lib/tracks.js falls back to it when `tracks` is
-- empty) and is dropped in a later cleanup migration.
--
-- `onboarded_at` gates the first-run wizard (spec 02): null ⇒ show it.

alter table public.profiles
  add column tracks text[] not null default '{}',
  add column onboarded_at timestamptz;

-- Existing accounts keep their behavior and skip the wizard.
update public.profiles set tracks = case focus
  when 'PM'   then array['pm']
  when 'Both' then array['swe', 'pm']
  else array['swe'] end;
update public.profiles set onboarded_at = now();

alter table public.profiles add constraint profiles_tracks_valid
  check (tracks <@ array['swe', 'pm', 'ib', 'quant', 'consulting']::text[]);

-- Existing "profiles: read own" / "update own" policies already cover both columns.
