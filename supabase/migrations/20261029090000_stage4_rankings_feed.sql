-- Stage 4, rankings in the feed (ADR 0099, step 3): the ranking and tier list cards that the people you follow shared,
-- and your own, newest first, for the Following tab. The same rules as `following_feed`: public profiles only (and
-- yours), nobody blocked either way, follows that are live. Only shared cards with their PNG: sharing is the publish.
create index if not exists cards_rankings_shared_at on public.cards (shared_at desc)
  where kind in ('ranking', 'tier_list') and shared_at is not null and deleted_at is null;

create function public.following_rankings(p_before timestamptz default null, p_limit integer default 10)
returns table (
  card_id uuid, kind text, template_id text, size text, params jsonb, image_path text, shared_at timestamptz,
  user_id uuid, username text, display_name text, avatar_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  people as (
    select id from me where id is not null
    union
    select f.followee_id from public.follows f, me
    where f.follower_id = me.id and f.deleted_at is null
  )
  select c.id, c.kind, c.template_id, c.size, c.params, c.image_path, c.shared_at,
    p.id, p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end
  from people
  join public.cards c on c.user_id = people.id
  join public.profiles p on p.id = c.user_id
  cross join me
  where c.kind in ('ranking', 'tier_list')
    and c.shared_at is not null
    and c.deleted_at is null
    and c.image_path is not null
    and (c.user_id = me.id or (p.visibility = 'public' and not private.is_blocked_between(c.user_id, me.id)))
    and (p_before is null or c.shared_at < p_before)
  order by c.shared_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 10), 1), 30);
$$;

revoke execute on function public.following_rankings(timestamptz, integer) from public, anon;
grant execute on function public.following_rankings(timestamptz, integer) to authenticated;
