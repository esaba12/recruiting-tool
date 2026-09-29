-- Learn tab — interview-prep tracking (LeetCode / system design / SQL / networking for SWE,
-- technicals for IB, etc.). Four ordinary per-user tables, same `auth.uid() = user_id`
-- pattern as contacts — nothing here is shared across users.
--
-- learning_tracks  — one per recruiting type the user is prepping for (SWE, IB, custom…).
--                    `config` holds the customize-editor state: which stat widgets are
--                    visible and in what order, the user's goals, and the LeetCode username.
-- learning_topics  — the editable topic tree for a track (seeded from a built-in template,
--                    then renamed/hidden/reordered/added-to by the user or AI suggestions).
-- learning_items   — one row per distinct problem/card (a LeetCode slug, a manual problem),
--                    carrying spaced-repetition state for the re-solve queue. Unique per
--                    (user, source, external_ref) so LeetCode re-imports are idempotent.
-- learning_logs    — every attempt/session/mock/assessment/explain-back. The mastery engine
--                    (app/src/lib/learning/mastery.js) is a pure function of these rows.

create table public.learning_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'custom',        -- 'swe' | 'ib' | 'pm' | 'quant' | 'custom'
  name text not null,
  config jsonb not null default '{}',
  sort int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index learning_tracks_user_id_idx on public.learning_tracks(user_id);

create table public.learning_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid not null references public.learning_tracks(id) on delete cascade,
  name text not null,
  category text not null default 'General',
  lc_tags text[] not null default '{}',       -- LeetCode tagSlugs that count toward this topic
  target_level smallint not null default 3 check (target_level between 1 and 5),
  self_rating smallint check (self_rating between 1 and 5),
  weight real not null default 1,
  hidden boolean not null default false,
  sort int not null default 0,
  source text not null default 'template',    -- 'template' | 'user' | 'ai'
  rubric jsonb,                               -- explain-back rubric points (template-provided)
  created_at timestamptz not null default now()
);
create index learning_topics_track_idx on public.learning_topics(track_id);

create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null default 'manual',      -- 'leetcode' | 'manual' | …
  external_ref text not null,                 -- LeetCode titleSlug, or a generated ref
  title text not null,
  url text,
  difficulty text,                            -- 'Easy' | 'Medium' | 'Hard'
  tags text[] not null default '{}',
  srs jsonb,                                  -- ts-fsrs Card (null = not in the review queue)
  due_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_ref)
);
create index learning_items_due_idx on public.learning_items(user_id, due_at) where due_at is not null;

create table public.learning_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  track_id uuid references public.learning_tracks(id) on delete cascade,
  topic_ids uuid[] not null default '{}',
  item_id uuid references public.learning_items(id) on delete set null,
  application_id uuid references public.applications(id) on delete set null,
  kind text not null default 'problem',       -- 'problem'|'session'|'mock'|'assessment'|'explain_back'|'reading'
  source text not null default 'manual',      -- 'manual' | 'leetcode' | 'codesignal' | 'hackerrank' | …
  external_ref text,                          -- import idempotency (e.g. LeetCode submission id)
  title text,
  difficulty text,
  outcome text,                               -- 'solved' | 'hinted' | 'failed'
  minutes int,
  confidence smallint check (confidence between 1 and 5),
  score real,
  notes text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index learning_logs_user_time_idx on public.learning_logs(user_id, occurred_at desc);
-- Full (not partial) unique constraint so PostgREST can name it in ON CONFLICT for
-- idempotent LeetCode imports; NULL external_refs (manual logs) never collide.
alter table public.learning_logs add constraint learning_logs_import_key unique (user_id, source, external_ref);

alter table public.learning_tracks enable row level security;
alter table public.learning_topics enable row level security;
alter table public.learning_items  enable row level security;
alter table public.learning_logs   enable row level security;

create policy "learning_tracks: all own" on public.learning_tracks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning_topics: all own" on public.learning_topics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning_items: all own" on public.learning_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "learning_logs: all own" on public.learning_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
