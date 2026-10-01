-- Stage 4: the Atlas's regions (docs/product/features/S4-atlas.md, ADR 0060). The states, provinces or regions a
-- person has been to inside a country, marked on that country's own map. A region is an id from src/core/regions.ts
-- (ISO 3166-2 where there is one, generated from Natural Earth by scripts/atlas-regions.mjs); its country is the id's
-- first two letters. Marking one puts the country on the Atlas as visited (the app does that in the same request).
-- Same privacy as places: visitors read them only when the profile is public and its Atlas shown.

create table public.place_regions (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  region     text not null check (region ~ '^[A-Z]{2}-[A-Z0-9]{1,8}$'),
  country    text not null generated always as (left(region, 2)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

comment on table public.place_regions is
  'The Atlas: regions (states, provinces, …) of a country a person has been to (ADR 0060). Private like places.';

-- One live row per region; unmarking is a soft delete, marking again a new row.
create unique index place_regions_one_live on public.place_regions (user_id, region) where deleted_at is null;
create index place_regions_user_id_country on public.place_regions (user_id, country) where deleted_at is null;
create index place_regions_user_id_updated_at on public.place_regions (user_id, updated_at);

create trigger place_regions_set_updated_at
  before update on public.place_regions
  for each row execute function public.set_updated_at();

alter table public.place_regions enable row level security;

create policy "people read their regions" on public.place_regions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "live regions of public atlases are readable" on public.place_regions for select to anon, authenticated
  using (deleted_at is null and private.is_public_atlas(user_id));
create policy "people add regions" on public.place_regions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "people update their regions" on public.place_regions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.place_regions from anon;
revoke insert, update, delete on public.place_regions from authenticated;
grant select on public.place_regions to anon, authenticated;
grant insert (id, user_id, region) on public.place_regions to authenticated;
grant update (deleted_at) on public.place_regions to authenticated;
