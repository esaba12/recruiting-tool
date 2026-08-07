alter table public.applications
  add column referred_by_id uuid references public.contacts(id) on delete set null;
