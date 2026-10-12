-- In-app feedback (v1.2 spec 07). Users can only INSERT their own rows; there is no
-- client-facing SELECT/UPDATE/DELETE policy, so nobody — including the author — can read
-- feedback back through the API. The owner reads it in the Supabase dashboard.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null check (length(message) between 1 and 4000),
  page text check (page is null or length(page) <= 100),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "feedback: insert own" on public.feedback
  for insert with check (auth.uid() = user_id);
