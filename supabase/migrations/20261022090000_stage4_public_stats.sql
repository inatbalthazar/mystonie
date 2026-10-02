-- Stage 4: a profile's Stats tab for visitors (ADR 0077). /u/[username]/stats shows a public profile's stats, computed
-- from rows visitors could already read (entries, episode and reading logs). Its owner hides any of its parts from
-- visitors (stats_hidden) and still sees them all on Me's Stats. Hiding is about the page only, as with album_hidden.
-- The section names match STATS_SECTIONS in src/core/album.ts; a new section needs this list widened.

alter table public.profiles
  add column stats_hidden text[] not null default '{}' check (
    stats_hidden <@ array['numbers', 'activity', 'months', 'taste', 'favourites', 'records', 'milestones']::text[]
    and cardinality(stats_hidden) <= 7
  );

grant update (stats_hidden) on public.profiles to authenticated;

-- /u/[username]: the same as before, plus the stats' hidden parts while the profile is visible to the viewer.
drop function public.public_profile(text);
create function public.public_profile(p_username text)
returns table (
  id uuid, username text, display_name text, avatar_url text, is_private boolean, created_at timestamptz,
  blocked_by_me boolean, bio text, album_order text[], album_hidden text[], shelf_pins uuid[], stats_hidden text[]
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
    case when visible then shelf_pins end,
    case when visible then stats_hidden end
  from p;
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;
