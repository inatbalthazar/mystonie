-- Stage 3 social (docs/product/features/S3-social.md, ADR 0037): follows, blocks, Stamps (kudos on a finish), the
-- Following feed, activity and finding people. Follows, blocks and stamps are user rows under the day-one rules
-- (UUID v7, server-stamped updated_at, soft delete, no client DELETE), like entries (ADR 0021).

-- ---------------------------------------------------------------------------
-- blocks: a user hides someone from themselves, both ways (profiles, entries, gallery, feed, search, stamps).
-- Only the blocker ever sees the row: being blocked is never announced.
-- ---------------------------------------------------------------------------
create table public.blocks (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create unique index blocks_one_active_per_pair on public.blocks (blocker_id, blocked_id) where deleted_at is null;
create index blocks_blocked_id on public.blocks (blocked_id, blocker_id) where deleted_at is null;
create index blocks_blocker_id_updated_at on public.blocks (blocker_id, updated_at);

create trigger blocks_set_updated_at
  before update on public.blocks
  for each row execute function public.set_updated_at();

-- True when either user has blocked the other. Only called from the security definer functions below.
create or replace function private.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks
    where deleted_at is null
      and ((blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
  );
$$;

revoke execute on function private.is_blocked_between(uuid, uuid) from public, anon, authenticated;

-- The visibility check behind every public-read policy (entries, episode and reading logs, the card gallery) now
-- also hides the two sides of a block from each other. Signed-out visitors have no uid, so nothing changes for them.
create or replace function private.is_public_profile(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = uid and visibility = 'public')
    and not private.is_blocked_between(uid, (select auth.uid()));
$$;

-- /u/[username]: someone who blocked the viewer looks private to them. The blocker still gets the id back
-- (blocked_by_me), so their page can offer Unblock.
drop function public.public_profile(text);
create function public.public_profile(p_username text)
returns table (
  id uuid, username text, display_name text, avatar_url text, is_private boolean, created_at timestamptz,
  blocked_by_me boolean
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
    blocked_by_me
  from p;
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- follows: one-directional, no approval. Only public profiles can be followed (private albums have no followers
-- yet: follow requests are an open question). The follower sees their rows (deleted ones too, for sync);
-- the person followed sees who follows them.
-- ---------------------------------------------------------------------------
create table public.follows (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint follows_not_self check (follower_id <> followee_id)
);

create unique index follows_one_active_per_pair on public.follows (follower_id, followee_id) where deleted_at is null;
create index follows_followee_id on public.follows (followee_id, created_at desc) where deleted_at is null;
create index follows_follower_id_updated_at on public.follows (follower_id, updated_at);

create trigger follows_set_updated_at
  before update on public.follows
  for each row execute function public.set_updated_at();

-- Following thousands of people is someone scripting the API.
create function private.limit_follows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null
     and (select count(*) from public.follows
          where follower_id = new.follower_id and deleted_at is null and id <> new.id) >= 2000 then
    raise exception 'too many follows' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function private.limit_follows() from public, anon, authenticated;

create trigger follows_limit
  before insert or update of deleted_at on public.follows
  for each row execute function private.limit_follows();

-- ---------------------------------------------------------------------------
-- stamps: a Stamp (kudos) on someone's finish. owner_id is the entry's owner, copied by a trigger, so "stamps on
-- my finishes" is one index. Only live finished entries of public, unblocked profiles, never your own.
-- ---------------------------------------------------------------------------
create table public.stamps (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id   uuid not null references public.entries (id) on delete cascade,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index stamps_one_active_per_entry on public.stamps (user_id, entry_id) where deleted_at is null;
create index stamps_entry_id on public.stamps (entry_id) where deleted_at is null;
create index stamps_owner_id on public.stamps (owner_id, created_at desc) where deleted_at is null;
create index stamps_user_id_updated_at on public.stamps (user_id, updated_at);

create trigger stamps_set_updated_at
  before update on public.stamps
  for each row execute function public.set_updated_at();

create function private.set_stamp_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.owner_id := (select user_id from public.entries where id = new.entry_id);
  return new;
end;
$$;

revoke execute on function private.set_stamp_owner() from public, anon, authenticated;

create trigger stamps_set_owner
  before insert or update of entry_id on public.stamps
  for each row execute function private.set_stamp_owner();

-- Whether the caller may stamp this entry: a live finish of someone else whose profile they can see.
create or replace function private.can_stamp(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.id = p_entry_id
      and e.deleted_at is null
      and e.status = 'finished'
      and e.user_id <> (select auth.uid())
      and private.is_public_profile(e.user_id)
  );
$$;

revoke execute on function private.can_stamp(uuid) from public;
grant execute on function private.can_stamp(uuid) to authenticated;

-- A block removes what linked the two: follows and stamps, both ways (soft delete, so sync sees it).
create function private.apply_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;
  update public.follows set deleted_at = now()
  where deleted_at is null
    and ((follower_id = new.blocker_id and followee_id = new.blocked_id)
      or (follower_id = new.blocked_id and followee_id = new.blocker_id));
  update public.stamps set deleted_at = now()
  where deleted_at is null
    and ((user_id = new.blocker_id and owner_id = new.blocked_id)
      or (user_id = new.blocked_id and owner_id = new.blocker_id));
  return new;
end;
$$;

revoke execute on function private.apply_block() from public, anon, authenticated;

create trigger blocks_apply
  after insert or update of deleted_at on public.blocks
  for each row execute function private.apply_block();

-- ---------------------------------------------------------------------------
-- RLS and column grants
-- ---------------------------------------------------------------------------
alter table public.blocks enable row level security;
alter table public.follows enable row level security;
alter table public.stamps enable row level security;

create policy "blockers read their blocks" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "users block others" on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "blockers update their blocks" on public.blocks for update to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create policy "followers read their follows" on public.follows for select to authenticated
  using (follower_id = (select auth.uid()));
create policy "people read who follows them" on public.follows for select to authenticated
  using (followee_id = (select auth.uid()) and deleted_at is null);
create policy "users follow public profiles" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and private.is_public_profile(followee_id));
-- Unfollow is a soft delete; bringing a row back needs the same check as a new follow.
create policy "followers update their follows" on public.follows for update to authenticated
  using (follower_id = (select auth.uid()))
  with check (follower_id = (select auth.uid()) and (deleted_at is not null or private.is_public_profile(followee_id)));

create policy "stampers read their stamps" on public.stamps for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners read stamps on their finishes" on public.stamps for select to authenticated
  using (owner_id = (select auth.uid()) and deleted_at is null);
create policy "users stamp finishes they can see" on public.stamps for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_stamp(entry_id));
create policy "stampers update their stamps" on public.stamps for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (deleted_at is not null or private.can_stamp(entry_id)));

revoke all on public.blocks, public.follows, public.stamps from anon;
revoke insert, update, delete on public.blocks, public.follows, public.stamps from authenticated;
grant insert (id, blocker_id, blocked_id) on public.blocks to authenticated;
grant update (deleted_at) on public.blocks to authenticated;
grant insert (id, follower_id, followee_id) on public.follows to authenticated;
grant update (deleted_at) on public.follows to authenticated;
grant insert (id, user_id, entry_id) on public.stamps to authenticated;
grant update (deleted_at) on public.stamps to authenticated;

-- ---------------------------------------------------------------------------
-- Reads across users. Security definer, because the caller can't read other people's profiles rows; each one
-- applies visibility and blocks itself and returns only the safe profile columns.
-- ---------------------------------------------------------------------------

-- Newest finishes first. The feed never needs a finish that finished_at puts in the far future (hand-edited dates).
create index entries_finished_feed on public.entries (user_id, finished_at desc, id desc)
  where status = 'finished' and deleted_at is null;

-- The Following feed: the caller's own finishes plus those of public, unblocked people they follow, newest first,
-- keyset-paged by (finished_at, entry id). With stamp counts and the latest shared finish card.
create function public.following_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text
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
  select e.id, e.finished_at, e.rating, e.review,
    p.id, p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end,
    t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path,
    (select count(*)::int from public.stamps s where s.entry_id = e.id and s.deleted_at is null),
    exists (select 1 from public.stamps s, me where s.entry_id = e.id and s.user_id = me.id and s.deleted_at is null),
    c.id, c.image_path
  from people
  join public.entries e on e.user_id = people.id
  join public.profiles p on p.id = e.user_id
  join public.titles t on t.id = e.title_id
  cross join me
  left join lateral (
    select c.id, c.image_path from public.cards c
    where c.entry_id = e.id and c.user_id = e.user_id and c.kind = 'finish'
      and c.shared_at is not null and c.deleted_at is null
    order by c.shared_at desc
    limit 1
  ) c on true
  where e.status = 'finished'
    and e.deleted_at is null
    and e.finished_at <= now() + interval '1 day'
    and (e.user_id = me.id or (p.visibility = 'public' and not private.is_blocked_between(e.user_id, me.id)))
    and (p_before is null or (e.finished_at, e.id) < (p_before, coalesce(p_before_id, 'ffffffff-ffff-7fff-bfff-ffffffffffff'::uuid)))
  order by e.finished_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- What happened to the caller: Stamps on their finishes and new followers, newest first, blocked people left out.
-- Private actors show their username only. `i_follow`: whether the caller follows the actor (Follow back).
create function public.my_activity(p_limit integer default 20)
returns table (
  kind text, at timestamptz, user_id uuid, username text, display_name text, avatar_url text, i_follow boolean,
  entry_id uuid, title_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  items as (
    select 'stamp' as kind, s.created_at as at, s.user_id as actor, s.entry_id, t.name as title_name
    from public.stamps s
    join public.entries e on e.id = s.entry_id and e.deleted_at is null
    join public.titles t on t.id = e.title_id, me
    where s.owner_id = me.id and s.deleted_at is null
    union all
    select 'follow', f.created_at, f.follower_id, null, null
    from public.follows f, me
    where f.followee_id = me.id and f.deleted_at is null
  )
  select i.kind, i.at, p.id, p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end,
    exists (select 1 from public.follows f where f.follower_id = me.id and f.followee_id = p.id and f.deleted_at is null),
    i.entry_id, i.title_name
  from items i
  join public.profiles p on p.id = i.actor
  cross join me
  where me.id is not null and not private.is_blocked_between(p.id, me.id)
  order by i.at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- Follower and following counts of a profile the caller can see (their own included), and whether they follow it.
create function public.follow_counts(p_user_id uuid)
returns table (followers integer, following integer, i_follow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.follows where followee_id = p_user_id and deleted_at is null),
    (select count(*)::int from public.follows where follower_id = p_user_id and deleted_at is null),
    exists (select 1 from public.follows
            where follower_id = (select auth.uid()) and followee_id = p_user_id and deleted_at is null)
  where p_user_id = (select auth.uid()) or private.is_public_profile(p_user_id);
$$;

-- Find people: public, unblocked profiles by username prefix or display name, the caller left out. Exact username
-- first, then people with more finishes. Wildcards in the query are matched literally.
create function public.search_people(p_query text)
returns table (id uuid, username text, display_name text, avatar_url text, finished integer, i_follow boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(trim(p_query)) as raw,
      replace(replace(replace(lower(trim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') as esc
  )
  select p.id, p.username, p.display_name, p.avatar_url,
    (select count(*)::int from public.entries e where e.user_id = p.id and e.status = 'finished' and e.deleted_at is null) as finished,
    exists (select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.followee_id = p.id and f.deleted_at is null)
  from public.profiles p, q
  where char_length(q.raw) between 2 and 50
    and (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and p.visibility = 'public'
    and (p.username like q.esc || '%' or lower(p.display_name) like '%' || q.esc || '%')
    and not private.is_blocked_between(p.id, (select auth.uid()))
  order by p.username = q.raw desc, finished desc, p.username
  limit 20;
$$;

-- The people the caller follows (newest first), for the Find people page. Private ones show their username only.
create function public.my_following()
returns table (id uuid, username text, display_name text, avatar_url text, followed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end,
    f.created_at
  from public.follows f
  join public.profiles p on p.id = f.followee_id
  where f.follower_id = (select auth.uid()) and f.deleted_at is null
  order by f.created_at desc
  limit 500;
$$;

-- The people the caller blocked, with their username (Unblock).
create function public.my_blocks()
returns table (id uuid, username text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid()) and b.deleted_at is null
  order by b.created_at desc;
$$;

revoke execute on function public.following_feed(timestamptz, uuid, integer) from public, anon;
revoke execute on function public.my_activity(integer) from public, anon;
revoke execute on function public.follow_counts(uuid) from public;
revoke execute on function public.search_people(text) from public, anon;
revoke execute on function public.my_following() from public, anon;
revoke execute on function public.my_blocks() from public, anon;
grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;
grant execute on function public.my_activity(integer) to authenticated;
grant execute on function public.follow_counts(uuid) to anon, authenticated;
grant execute on function public.search_people(text) to authenticated;
grant execute on function public.my_following() to authenticated;
grant execute on function public.my_blocks() to authenticated;
