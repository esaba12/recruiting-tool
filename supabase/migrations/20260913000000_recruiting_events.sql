-- Recruiting Events — school-scoped SHARED event pool + per-user overlays.
--
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │ TENANCY NOTE — this migration introduces the repo's FIRST shared data.  │
-- │                                                                         │
-- │ Every table before this one is either (a) per-user, `auth.uid() =       │
-- │ user_id` for all four verbs, or (b) zero-policy, service-role only.     │
-- │ The tables marked [SHARED] below are a third shape:                     │
-- │                                                                         │
-- │   • READ  — any authenticated user whose profiles.school_id matches the │
-- │             row's school_id (plus a user's own private rows).           │
-- │   • WRITE — no client-facing policy at all. Only server code holding    │
-- │             the service-role key (the ingestion / contribute / enrich   │
-- │             handlers in app/api/) can insert/update/delete. A user      │
-- │             never writes to the shared pool directly, so one client bug │
-- │             or one malicious session can't poison everyone's feed.      │
-- │                                                                         │
-- │ The per-user overlay tables ([PER-USER]) keep the existing shape — a    │
-- │ user's status, notes, relevance and requirement completions are         │
-- │ invisible to every other user, including in aggregates.                 │
-- └─────────────────────────────────────────────────────────────────────────┘

-- ── Schools [SHARED, global read] ───────────────────────────────────────────
-- Canonical campus rows. Adding a campus is a config row, not code: feed_config
-- carries the per-platform adapter settings (Localist base URL + group ids, etc.)
-- and term_windows carries the academic calendar the freshness gate validates
-- ingested dates against.
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                         -- 'umich'
  name text not null,                                -- 'University of Michigan'
  email_domain text,                                 -- 'umich.edu' — hint for auto-resolving profiles
  timezone text not null default 'America/Detroit',  -- IANA
  feed_config jsonb not null default '{}'::jsonb,    -- { sources: [{ kind, ...adapter params }] }
  term_windows jsonb not null default '[]'::jsonb,   -- [{ name, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }]
  transit_buffer_min int not null default 15,        -- default walking buffer for the conflict engine
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;
create policy "schools: read all (authenticated)" on public.schools
  for select to authenticated using (true);
-- No write policies — service_role only.

-- ── Employers [SHARED, global read] ─────────────────────────────────────────
-- Canonical employer entity. contacts.company / applications.company stay
-- free-text (Coverage, Discover, Explore, job-board dedup and the email pipeline
-- all key off that text via normalizeCompanyName()); this table is resolved
-- alongside them through a nullable employer_id, never in place of them.
create table public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,              -- normalizeCompanyName(name)
  website text,
  created_at timestamptz not null default now()
);

alter table public.employers enable row level security;
create policy "employers: read all (authenticated)" on public.employers
  for select to authenticated using (true);
-- No write policies — service_role only.

-- ── Resolve existing free-text columns alongside, never in place ─────────────
-- (Declared before events so current_user_school_id() below can reference
-- profiles.school_id at creation time — SQL function bodies are validated then.)
alter table public.profiles
  add column school_id uuid references public.schools(id) on delete set null;
alter table public.contacts
  add column employer_id uuid references public.employers(id) on delete set null;
alter table public.applications
  add column employer_id uuid references public.employers(id) on delete set null;

-- ── Events [SHARED, school-scoped read] ─────────────────────────────────────
-- Ingested and deduped ONCE per school; every user at that school reads the
-- same rows. `visibility='private'` rows are the exception — manual entries a
-- user hasn't promoted yet, readable only by their contributor.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  contributed_by uuid references auth.users(id) on delete set null,  -- null for feed-ingested rows
  kind text not null default 'other'
    check (kind in ('career_fair', 'info_session', 'coffee_chat', 'workshop', 'networking', 'other')),
  title text not null,
  description text,
  location text,
  is_virtual boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  timezone text,                                      -- IANA, as stated by the source
  url text,
  registration_url text,
  registration_deadline timestamptz,
  employer_id uuid references public.employers(id) on delete set null,
  source_kind text not null
    check (source_kind in ('localist', 'paste', 'csv', 'ics', 'manual')),
  source_ref text,                                    -- adapter-stable id (Localist instance id, ICS UID, …)
  source_last_verified_at timestamptz not null default now(),  -- > 14d ⇒ stale badge, scorer won't upgrade
  dedup_key text not null,                            -- lib/ingest/dedup.js: norm(title)|employer|start-hour
  confidence numeric(3,2) not null default 1.00,      -- 1.00 for feeds; extraction confidence for contributions
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_school_starts_idx on public.events(school_id, starts_at) where not archived;
-- Exact-source identity: the same Localist instance never lands twice.
create unique index events_source_ref_idx on public.events(school_id, source_kind, source_ref)
  where source_ref is not null;
-- Semantic identity: a contributed twin of an already-ingested shared event
-- can't create a second shared row. (±1h near-duplicates are handled in
-- application dedup before insert; this index is the hard backstop.)
create unique index events_shared_dedup_idx on public.events(school_id, dedup_key)
  where visibility = 'shared' and not archived;

-- ── Per-user school lookup for the shared-pool read policies ─────────────────
-- SECURITY DEFINER + STABLE so the policy resolves the caller's school once per
-- statement without recursing through profiles' own RLS on every candidate row.
create function public.current_user_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

revoke all on function public.current_user_school_id() from public;
grant execute on function public.current_user_school_id() to authenticated;

alter table public.events enable row level security;
create policy "events: read own school's shared pool or own private rows" on public.events
  for select to authenticated using (
    (visibility = 'shared' and school_id = public.current_user_school_id())
    or (visibility = 'private' and contributed_by = auth.uid())
  );
-- No insert/update/delete policies — service_role only (see TENANCY NOTE).

-- ── Event attributes [SHARED] — extracted ONCE per event, never per user ─────
create table public.event_attributes (
  event_id uuid primary key references public.events(id) on delete cascade,
  roles text[] not null default '{}',                 -- ['SWE', 'PM', …]
  majors text[] not null default '{}',
  term text,                                          -- 'Fall 2026'
  format text check (format in ('in_person', 'virtual', 'hybrid')),
  sponsorship text check (sponsorship in ('yes', 'no', 'unknown')),
  employer_ids uuid[] not null default '{}',          -- multi-employer fairs
  content_hash text,                                  -- hash of the event text the extraction ran on
  model text,
  extracted_at timestamptz,
  raw jsonb
);

alter table public.event_attributes enable row level security;
-- Delegates to events' own policy: the subquery runs as the caller, so an
-- event the caller can't read yields no attribute row either.
create policy "event_attributes: read if event readable" on public.event_attributes
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_attributes.event_id)
  );

-- ── Event requirements [SHARED] — the multi-step signup ladder ───────────────
create table public.event_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  step_order int not null,
  kind text not null check (kind in (
    'register', 'email_recruiter_to_confirm', 'rsvp_external',
    'upload_resume', 'apply_first', 'invite_only_selection'
  )),
  label text,
  url text,
  due_at timestamptz,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, step_order)
);

create index event_requirements_event_idx on public.event_requirements(event_id);

alter table public.event_requirements enable row level security;
create policy "event_requirements: read if event readable" on public.event_requirements
  for select to authenticated using (
    exists (select 1 from public.events e where e.id = event_requirements.event_id)
  );

-- ── Ingest sources [SHARED, school-scoped read] — per-source health ──────────
-- One row per (school, adapter, ref). `degraded_at` is set when a feed returns
-- dates inconsistent with the school's term windows (the "2023 data from a 2026
-- query" failure); ingestion skips a degraded source and the UI surfaces it.
create table public.ingest_sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  kind text not null,                                 -- 'localist' | …
  ref text not null,                                  -- adapter-specific: group id, url, …
  label text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_count int,
  degraded_at timestamptz,
  degraded_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, kind, ref)
);

alter table public.ingest_sources enable row level security;
create policy "ingest_sources: read own school" on public.ingest_sources
  for select to authenticated using (school_id = public.current_user_school_id());

-- ── User ↔ event relevance [PER-USER] ───────────────────────────────────────
create table public.user_event_relevance (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  score numeric(5,2),
  tier text check (tier in ('high', 'medium', 'low')),
  reason text,
  override_tier text check (override_tier in ('high', 'medium', 'low')),
  dismissed_at timestamptz,
  input_hash text,                                    -- profile+targets+event hash the score was computed from
  computed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.user_event_relevance enable row level security;
create policy "user_event_relevance: all own" on public.user_event_relevance
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── User ↔ event state [PER-USER] ───────────────────────────────────────────
-- `confirmed` is only legal once every required requirement has a completion
-- row — enforced in lib/eventRequirements.js (allRequiredComplete), not here,
-- since the gate is a derivation over two tables.
create table public.user_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null default 'interested'
    check (status in ('interested', 'registering', 'confirmed', 'attended', 'skipped')),
  calendar_slot text check (calendar_slot in ('personal', 'school')),
  calendar_event_id text,                             -- nulled (row kept) if deleted Google-side
  calendar_synced_at timestamptz,
  notes text,
  followup_due_at timestamptz,
  followup_done_at timestamptz,
  block_overrides jsonb not null default '{}'::jsonb, -- { [calendarBlockId]: 'soft' } — hard is the default
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.user_events enable row level security;
create policy "user_events: all own" on public.user_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── User requirement completions [PER-USER] ─────────────────────────────────
create table public.user_event_requirement_completions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  requirement_id uuid not null references public.event_requirements(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

alter table public.user_event_requirement_completions enable row level security;
create policy "user_event_requirement_completions: all own" on public.user_event_requirement_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── updated_at maintenance ───────────────────────────────────────────────────
create trigger schools_set_updated_at before update on public.schools
  for each row execute procedure public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute procedure public.set_updated_at();
create trigger ingest_sources_set_updated_at before update on public.ingest_sources
  for each row execute procedure public.set_updated_at();
create trigger user_event_relevance_set_updated_at before update on public.user_event_relevance
  for each row execute procedure public.set_updated_at();
create trigger user_events_set_updated_at before update on public.user_events
  for each row execute procedure public.set_updated_at();

-- ── Seed: the first campus ───────────────────────────────────────────────────
-- Localist group 3172 = Engineering Career Resource Center (Career Cafes,
-- Department Career Days, the SWE/TBP fair). Term windows are deliberately
-- generous (a few weeks either side of classes) — they gate feed *freshness*,
-- not what a student may attend.
insert into public.schools (slug, name, email_domain, timezone, feed_config, term_windows, transit_buffer_min)
values (
  'umich',
  'University of Michigan',
  'umich.edu',
  'America/Detroit',
  '{"sources":[{"kind":"localist","base":"https://events.umich.edu","groupId":3172,"label":"Engineering Career Resource Center"}]}'::jsonb,
  '[{"name":"Fall 2026","start":"2026-08-10","end":"2026-12-31"},{"name":"Winter 2027","start":"2027-01-01","end":"2027-05-15"}]'::jsonb,
  15
)
on conflict (slug) do nothing;

-- ── Auto-resolve school on signup from the email domain ─────────────────────
-- Existing users keep their free-text `school` and pick a campus in Settings;
-- new signups with a known .edu domain land in the right pool immediately.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, school_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    (select s.id from public.schools s where s.email_domain = split_part(new.email, '@', 2) limit 1)
  );
  return new;
end;
$$;
