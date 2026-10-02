-- Stage 4: the album as its owner arranges it (ADR 0069). Under the cover and the all-time numbers, the album's
-- sections come in the owner's order (album_order, empty: the default order), minus the ones they hid (album_hidden;
-- the Atlas keeps its own switch, atlas_public), and the Shelf starts with up to 4 pinned favourites (shelf_pins,
-- title ids). Hiding is about the page only: what a public album shows stays readable, as before.
-- The section names match ALBUM_SECTIONS in src/core/album.ts; a new section needs this list widened.

alter table public.profiles
  add column album_order text[] not null default '{}' check (
    album_order <@ array['cards', 'watching', 'shelf', 'stickers', 'atlas', 'patches', 'clubs', 'saved']::text[]
    and cardinality(album_order) <= 8
  ),
  add column album_hidden text[] not null default '{}' check (
    album_hidden <@ array['cards', 'watching', 'shelf', 'stickers', 'patches', 'clubs', 'saved']::text[]
    and cardinality(album_hidden) <= 7
  ),
  add column shelf_pins uuid[] not null default '{}' check (
    cardinality(shelf_pins) <= 4 and array_position(shelf_pins, null) is null
  );

grant update (album_order, album_hidden, shelf_pins) on public.profiles to authenticated;

-- /u/[username]: the same as before, plus the album's arrangement while the profile is visible to the viewer.
drop function public.public_profile(text);
create function public.public_profile(p_username text)
returns table (
  id uuid, username text, display_name text, avatar_url text, is_private boolean, created_at timestamptz,
  blocked_by_me boolean, bio text, album_order text[], album_hidden text[], shelf_pins uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select p.*,
      p.visibility = 'public' and not private.is_blocked_between(p.id, (select auth.uid())) as visible,
      exists (select 1 from public.blocks b
              where b.blocker_id = (select auth.uid()) and b.blocked_id = p.id and b.deleted_at is null) as blocked_by_me
    from public.profiles p
    where p.username = lower(p_username)
  )
  select
    case when visible or blocked_by_me then id end,
    username,
    case when visible then display_name end,
    case when visible then avatar_url end,
    not visible,
    case when visible then created_at end,
    blocked_by_me,
    case when visible then bio end,
    case when visible then album_order end,
    case when visible then album_hidden end,
    case when visible then shelf_pins end
  from p;
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
