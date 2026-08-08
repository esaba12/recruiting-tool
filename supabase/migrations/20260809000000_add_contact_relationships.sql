-- Typed, directed contact-to-contact relationships (Mentor Of, College Friend Of, etc.),
-- generalizing beyond the single referred_by_id self-relation. Additive alongside
-- contacts.referred_by_id, which keeps its narrower "who introduced me to this contact"
-- meaning unchanged. Modeled on the `interactions` table (a contact-scoped-but-independent
-- row) rather than an array column, since a relationship needs two endpoints.
create table public.contact_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_contact_id uuid not null references public.contacts(id) on delete cascade,
  to_contact_id uuid not null references public.contacts(id) on delete cascade,
  relationship_type text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint contact_relationships_no_self_loop check (from_contact_id <> to_contact_id),
  unique (from_contact_id, to_contact_id, relationship_type)
);

create index contact_relationships_user_id_idx on public.contact_relationships(user_id);
create index contact_relationships_from_idx on public.contact_relationships(from_contact_id);
create index contact_relationships_to_idx on public.contact_relationships(to_contact_id);

alter table public.contact_relationships enable row level security;
create policy "contact_relationships: all own" on public.contact_relationships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
