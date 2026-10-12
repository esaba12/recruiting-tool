# 01 — Multi-track profile

## Problem

`profiles.focus` is a single text column, `'SWE' | 'PM' | 'Both'`, with default `'SWE'`
(`supabase/migrations/20260723000000_init.sql:23`). The Settings dropdown offers only those three
values (`SettingsTab.jsx:259-263`). Learn already ships IB and Quant templates
(`lib/learning/templates.js:165,183`), but nothing upstream can select them. A finance friend can't
say they're recruiting for finance.

## Change

### Schema (new migration `supabase/migrations/20261009000000_profile_tracks.sql`)

```sql
alter table public.profiles
  add column tracks text[] not null default '{}',
  add column onboarded_at timestamptz;

-- Backfill: existing accounts keep their behavior and skip the wizard.
update public.profiles set tracks = case focus
  when 'PM'   then array['pm']
  when 'Both' then array['swe','pm']
  else array['swe'] end;
update public.profiles set onboarded_at = now();

alter table public.profiles add constraint profiles_tracks_valid
  check (tracks <@ array['swe','pm','ib','quant','consulting']::text[]);
```

- Keep `focus` for now as a compatibility column. Nothing writes it after this change, and the next cleanup migration drops it.
- New signups get `tracks = '{}'` and `onboarded_at = null`, which is how the wizard (spec 02) knows to show.
- Existing RLS policies ("read own" / "update own") already cover both columns. No policy changes.

### Single accessor: `app/src/lib/tracks.js` (new, pure)

```js
export const TRACKS = [
  { id: 'swe',        label: 'Software engineering', short: 'SWE' },
  { id: 'pm',         label: 'Product management',   short: 'PM' },
  { id: 'ib',         label: 'Investment banking / finance', short: 'IB' },
  { id: 'quant',      label: 'Quant / trading',      short: 'Quant' },
  { id: 'consulting', label: 'Consulting',           short: 'Consulting' },
]
export function profileTracks(profile)   // tracks[] if non-empty, else derived from legacy focus, else ['swe']
export function hasTrack(profile, id)
export function isTechOnly(profile)      // every track ∈ {swe, pm}
export function tracksLabel(profile)     // "SWE + IB" — for prompts and copy
```

Every reader below goes through this module, and nobody reads `profile.focus` directly.

### Fan-out: every current `focus` reader

| File | Today | Change |
|---|---|---|
| `SettingsTab.jsx:69,111,259` | single `<select>` | multi-select chip group (`ui/ChipToggleGroup.jsx` already exists), writes `tracks` |
| `lib/learning/templates.js:198` `defaultTemplateKeys(focus)` | SWE/PM only | `defaultTemplateKeys(tracks)` → map each track to its template key; add a `consulting` template (case interviews, market sizing, frameworks, fit; same shape as `ib`) |
| `LearnTab.jsx:47,131` | passes `profile?.focus` | passes `profileTracks(profile)` |
| `lib/eventRelevance.js:17,61` `FOCUS_ROLES` | SWE/PM/Both | `TRACK_ROLES = { swe:['SWE','Data'], pm:['PM'], ib:['Finance'], quant:['Quant'], consulting:['Consulting'] }`, union over the user's tracks. `inputHash` (`:88`) uses the sorted track list so relevance recomputes once after the change |
| `lib/eventEnrichment.js:39` roles enum | no finance value | add `"Finance"` to the enum. Already-enriched events keep their old roles. That's acceptable, because the content-hash gate means only new or changed events get re-read |
| `lib/companyFinder.js:87-90` | "SWE primary, PM secondary" | `tracksLabel(profile)` |
| `lib/drafting.js:9` | `focus` or `'CS'` | `tracksLabel(profile)`, with "student" as the fallback |

## Tests

- `test/tracks.test.js`: `profileTracks` for `{tracks:[]}` + each legacy focus, an explicit `tracks` value, and `null`.
- Extend the existing eventRelevance tests with an IB profile scoring a `Finance` event as high and a `SWE` event as low.
- `test/rls.test.js`: user A can't read or update user B's `tracks`/`onboarded_at` (same pattern as the existing profile cases, if present; add them if not).

## Acceptance

- After the migration, the owner account shows `tracks=['swe','pm']` (or whatever matches its focus), has `onboarded_at` set, and sees no wizard.
- In Settings, picking IB + Quant saves, and Learn's first-open picker pre-selects IB + Quant.
- `grep -rn "\.focus\b" app/src` returns only `lib/tracks.js` (the legacy fallback).

## Rollback

The migration is additive. The legacy `focus` fallback in `profileTracks` means old code keeps
working if the frontend is rolled back.
