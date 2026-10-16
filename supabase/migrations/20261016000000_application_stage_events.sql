-- Application stage history — one row per stage change, for the Sheet view's
-- "days in stage" / change markers and the Pipeline flow (Sankey) chart.
--
-- Stage is written from three places (the client via db.js, the Gmail scan in
-- app/api/_lib/emailPipeline.js, and the Apps Script pipeline), so history is
-- captured by a trigger here rather than in any one writer. `source` records who
-- made the change: the two pipelines write with the service-role key, the app
-- with the user's own JWT.
--
-- Clients can only read their own rows; nothing client-side writes this table.

create table public.application_stage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_at timestamptz not null default now(),
  source text not null check (source in ('user', 'pipeline', 'system', 'backfill'))
);

create index application_stage_events_user_idx on public.application_stage_events(user_id, changed_at);
create index application_stage_events_app_idx on public.application_stage_events(application_id, changed_at);

alter table public.application_stage_events enable row level security;
create policy "application_stage_events: read own" on public.application_stage_events
  for select to authenticated using (auth.uid() = user_id);

create function public.log_application_stage_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  jwt_role text := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  src text := case
    when jwt_role = 'service_role' then 'pipeline'
    when jwt_role = 'authenticated' then 'user'
    else 'system'
  end;
begin
  if tg_op = 'INSERT' then
    insert into public.application_stage_events (user_id, application_id, from_stage, to_stage, source)
    values (new.user_id, new.id, null, new.stage, src);
  elsif new.stage is distinct from old.stage then
    insert into public.application_stage_events (user_id, application_id, from_stage, to_stage, source)
    values (new.user_id, new.id, old.stage, new.stage, src);
  end if;
  return new;
end;
$$;

revoke all on function public.log_application_stage_change() from public;

create trigger applications_log_stage_change
  after insert or update of stage on public.applications
  for each row execute procedure public.log_application_stage_change();

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Existing rows only know their current stage. Reconstruct the simplest path
-- that reaches it: created → Applied (on applied_date) → current stage (on
-- closed_date / last_activity / updated_at). Where a rejection actually
-- happened is unknown, so it's recorded as straight from Applied and tagged
-- 'backfill' — the UI renders these as estimated.

insert into public.application_stage_events (user_id, application_id, from_stage, to_stage, changed_at, source)
select user_id, id, null, 'Wishlist', created_at, 'backfill'
from public.applications
where stage = 'Wishlist';

insert into public.application_stage_events (user_id, application_id, from_stage, to_stage, changed_at, source)
select user_id, id, null, 'Applied', coalesce(applied_date::timestamptz, created_at), 'backfill'
from public.applications
where stage <> 'Wishlist';

insert into public.application_stage_events (user_id, application_id, from_stage, to_stage, changed_at, source)
select user_id, id, 'Applied', stage,
       greatest(
         coalesce(closed_date::timestamptz, last_activity::timestamptz, updated_at),
         coalesce(applied_date::timestamptz, created_at)
       ),
       'backfill'
from public.applications
where stage not in ('Wishlist', 'Applied');

-- Live updates for the Sheet view (postgres_changes respects RLS).
alter publication supabase_realtime add table public.applications, public.application_stage_events;
