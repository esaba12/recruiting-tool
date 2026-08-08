-- Life-domain tag for the personal-CRM pivot: lets a contact be tagged
-- Friend/Family/Mentor/Community in addition to (or instead of)
-- Professional/Recruiting, and lets Overview/Actions know whether the user
-- has any recruiting-flavored contacts at all. Additive-only, mirrors the
-- existing `affinity text[]` column; already covered by the existing
-- "contacts: all own" RLS policy (for all using (auth.uid() = user_id)) —
-- no new policy needed.
alter table public.contacts
  add column life_domain text[] not null default '{}';
