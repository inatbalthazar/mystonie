-- Suggested people on Find people (ADR 0083): public, unblocked people the caller doesn't follow yet, each with what
-- they have in common with the caller, strongest first. Everything it uses is already public (their collection, their
-- clubs, their Atlas when shown) or the caller's own (their follows, their country), so nobody's private setting leaks:
-- a person's country counts only as a place they lived on a public Atlas, never their where-to-watch country.
create function public.suggested_people(p_limit integer default 10)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  finished integer,
  -- Titles both have in their collections (any status), and the newest one of them by name.
  shared integer,
  shared_title text,
  -- People the caller follows who follow them.
  mutuals integer,
  -- A club both are in.
  club text,
  -- A country they lived in (public Atlas) that is the caller's own (settings country or a place they lived).
  country text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid
  ),
  mine as (
    select e.title_id from public.entries e, me where e.user_id = me.uid and e.deleted_at is null
  ),
  my_follows as (
    select f.followee_id from public.follows f, me where f.follower_id = me.uid and f.deleted_at is null
  ),
  my_clubs as (
    select c.club from public.club_members c, me where c.user_id = me.uid and c.deleted_at is null
  ),
  my_countries as (
    select p.country from public.profiles p, me where p.id = me.uid and p.country is not null
    union
    select pl.country from public.places pl, me where pl.user_id = me.uid and pl.status = 'lived' and pl.deleted_at is null
  ),
  candidates as (
    select p.id, p.username, p.display_name, p.avatar_url, p.atlas_public
    from public.profiles p, me
    where me.uid is not null
      and p.id <> me.uid
      and p.visibility = 'public'
      and not exists (select 1 from my_follows mf where mf.followee_id = p.id)
      and not private.is_blocked_between(p.id, me.uid)
  ),
  scored as (
    select c.id, c.username, c.display_name, c.avatar_url,
      (select count(*)::int from public.entries e
        where e.user_id = c.id and e.status = 'finished' and e.deleted_at is null) as finished,
      (select count(*)::int from public.entries e join mine m on m.title_id = e.title_id
        where e.user_id = c.id and e.deleted_at is null) as shared,
      (select t.name from public.entries e join mine m on m.title_id = e.title_id join public.titles t on t.id = e.title_id
        where e.user_id = c.id and e.deleted_at is null order by e.updated_at desc limit 1) as shared_title,
      (select count(*)::int from public.follows f join my_follows mf on mf.followee_id = f.follower_id
        where f.followee_id = c.id and f.deleted_at is null) as mutuals,
      (select cm.club from public.club_members cm join my_clubs mc on mc.club = cm.club
        where cm.user_id = c.id and cm.deleted_at is null order by cm.club limit 1) as club,
      (select pl.country from public.places pl join my_countries mc on mc.country = pl.country
        where c.atlas_public and pl.user_id = c.id and pl.status = 'lived' and pl.deleted_at is null
        order by pl.country limit 1) as country
    from candidates c
  )
  select s.id, s.username, s.display_name, s.avatar_url, s.finished, s.shared, s.shared_title, s.mutuals, s.club, s.country
  from scored s
  -- Someone with nothing in common still shows when they finish things: a new account gets active collectors.
  where s.shared > 0 or s.mutuals > 0 or s.club is not null or s.country is not null or s.finished > 0
  order by s.shared * 3 + s.mutuals * 4 + (s.club is not null)::int * 3 + (s.country is not null)::int * 2
    + least(s.finished, 50) / 10.0 desc,
    s.finished desc, s.username
  limit least(greatest(coalesce(p_limit, 10), 1), 20);
$$;

revoke execute on function public.suggested_people(integer) from public, anon;
grant execute on function public.suggested_people(integer) to authenticated;
