-- Stage 4: the Atlas (docs/product/features/S4-atlas.md, ADR 0059). The countries a person has been to, lived in or
-- wants to go to, on Me's Atlas tab next to the countries their stories come from (read from titles.raw, no table).
-- Country level only (ISO 3166-1 alpha-2). Private by default: visitors see it only when the profile is public and
-- the owner turned "Show my Atlas on my profile" on (profiles.atlas_public), since where you've lived says where
-- you're from (ADR 0057 left nationality out).

create table public.places (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country    text not null check (country ~ '^[A-Z]{2}$'),
  -- been: visited. lived: lived there (counts as visited). want: want to go.
  status     text not null check (status in ('been', 'lived', 'want')),
  -- The year of the first visit, optional, and only for a visit.
  first_year smallint check (first_year between 1900 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint places_year_with_visit check (first_year is null or status <> 'want')
);

comment on table public.places is
  'The Atlas: countries a person has been to, lived in or wants to go to (ADR 0059). Private unless the profile is public and profiles.atlas_public.';

-- One live row per country; taking a country off is a soft delete, adding it back a new row.
create unique index places_one_live on public.places (user_id, country) where deleted_at is null;
create index places_user_id_updated_at on public.places (user_id, updated_at);

create trigger places_set_updated_at
  before update on public.places
  for each row execute function public.set_updated_at();

alter table public.profiles add column atlas_public boolean not null default false;
grant update (atlas_public) on public.profiles to authenticated;

-- The visibility check behind the public read policy: a public profile (and no block between the two) that shows
-- its Atlas.
create function private.is_public_atlas(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_public_profile(uid)
    and exists (select 1 from public.profiles where id = uid and atlas_public);
$$;

revoke execute on function private.is_public_atlas(uuid) from public;
grant execute on function private.is_public_atlas(uuid) to anon, authenticated;

alter table public.places enable row level security;

create policy "people read their places" on public.places for select to authenticated
  using (user_id = (select auth.uid()));
create policy "live places of public atlases are readable" on public.places for select to anon, authenticated
  using (deleted_at is null and private.is_public_atlas(user_id));
create policy "people add places" on public.places for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "people update their places" on public.places for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.places from anon;
revoke insert, update, delete on public.places from authenticated;
grant select on public.places to anon, authenticated;
grant insert (id, user_id, country, status, first_year) on public.places to authenticated;
grant update (status, first_year, deleted_at) on public.places to authenticated;

-- ---------------------------------------------------------------------------
-- Atlas cards: the visited countries coloured in on the world map.
-- ---------------------------------------------------------------------------
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review', 'challenge', 'reel', 'atlas'));
