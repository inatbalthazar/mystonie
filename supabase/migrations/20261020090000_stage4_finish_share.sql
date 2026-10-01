-- Stage 4, rare finishes instead of finisher numbers (ADR 0067). A finish isn't a race, so cards, the feed and title
-- pages stop showing "Finisher #N" and show how rare the finish was instead: the share of Mystonie's members who had
-- finished the title when this person did ("0.4% of Mystonie"), kept for good like the number was. The numbering
-- itself stays (the ledger is what the counts come from); only what people see changes.

-- ---------------------------------------------------------------------------
-- The ledger keeps, with each first finish, how many members Mystonie had and what share of them had finished the
-- title then (this person included). The entry carries a copy, as it does the number.
-- ---------------------------------------------------------------------------
alter table public.title_finishers
  add column members integer check (members > 0),
  add column share numeric check (share > 0 and share <= 1);

alter table public.entries
  add column finish_share numeric check (finish_share > 0 and finish_share <= 1),
  add column finish_members integer check (finish_members > 0);

-- Existing ledger rows: members who had joined by the time the number was handed out, and the people of that title
-- numbered by then who still have an account. Never more than all of them (back-dated imports can't push it past 1).
with shares as (
  select l.title_id, l.user_id,
    greatest(
      (select count(*)::int from public.profiles p where p.created_at <= l.created_at),
      (select count(*)::int from public.title_finishers o where o.title_id = l.title_id and o.number <= l.number),
      1
    ) as members,
    (select count(*)::int from public.title_finishers o where o.title_id = l.title_id and o.number <= l.number) as finishers
  from public.title_finishers l
)
update public.title_finishers l
set members = s.members, share = s.finishers::numeric / s.members
from shares s
where l.title_id = s.title_id and l.user_id = s.user_id;

update public.entries e
set finish_share = l.share, finish_members = l.members
from public.title_finishers l
where e.finisher_no is not null and l.title_id = e.title_id and l.user_id = e.user_id;

-- The user's number for a title, handing out the next one the first time (ADR 0039, unchanged), and now also
-- recording the share of members who had finished it at that moment. Counts the ledger (people with an account) and
-- all profiles: a first finish costs two counts, once per person and title.
create or replace function private.finisher_number(p_title_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  v_finishers integer;
  v_members integer;
begin
  select number into n from public.title_finishers where title_id = p_title_id and user_id = p_user_id;
  if found then
    return n;
  end if;

  insert into public.title_finish_counts (title_id) values (p_title_id) on conflict (title_id) do nothing;
  select title_finish_counts.finishers into n from public.title_finish_counts where title_id = p_title_id for update;

  -- A fresh snapshot after the lock: a request that held it may have just numbered this user.
  select number into n from public.title_finishers where title_id = p_title_id and user_id = p_user_id;
  if found then
    return n;
  end if;

  update public.title_finish_counts
  set finishers = title_finish_counts.finishers + 1, updated_at = now()
  where title_id = p_title_id
  returning title_finish_counts.finishers into n;

  select count(*)::int + 1 into v_finishers from public.title_finishers where title_id = p_title_id;
  select greatest(count(*)::int, v_finishers, 1) into v_members from public.profiles;
  insert into public.title_finishers (title_id, user_id, number, members, share)
  values (p_title_id, p_user_id, n, v_members, v_finishers::numeric / v_members);
  return n;
end;
$$;

revoke execute on function private.finisher_number(uuid, uuid) from public, anon, authenticated;

-- Every write of an entry: a live finish without a number gets its number and its share (its old ones when this
-- person finished the title before). Neither can be set by a request: clients have no grant on the columns, and the
-- trigger overwrites whatever the service role sends.
create or replace function private.assign_finisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.finisher_no := old.finisher_no;
    new.finish_share := old.finish_share;
    new.finish_members := old.finish_members;
  else
    new.finisher_no := null;
    new.finish_share := null;
    new.finish_members := null;
  end if;
  if new.status = 'finished' and new.deleted_at is null and new.finisher_no is null then
    new.finisher_no := private.finisher_number(new.title_id, new.user_id);
    select l.share, l.members into new.finish_share, new.finish_members
    from public.title_finishers l
    where l.title_id = new.title_id and l.user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.assign_finisher() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- How many members Mystonie has: a title page's live share ("3.2% of Mystonie finished this"). A count only.
-- ---------------------------------------------------------------------------
create function public.member_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.profiles;
$$;

revoke execute on function public.member_count() from public;
grant execute on function public.member_count() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Feed rows carry the finish's share and the member count it was taken from, in place of the number.
-- ---------------------------------------------------------------------------
drop function public.following_feed(timestamptz, uuid, integer);
create function public.following_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text,
  finish_share numeric, finish_members integer
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
    c.id, c.image_path, e.finish_share, e.finish_members
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

revoke execute on function public.following_feed(timestamptz, uuid, integer) from public, anon;
grant execute on function public.following_feed(timestamptz, uuid, integer) to authenticated;

drop function public.club_feed(text, text[], text[], text[], integer);
create function public.club_feed(
  p_club text, p_kinds text[] default null, p_genres text[] default null, p_languages text[] default null,
  p_limit integer default 20
)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text,
  finish_share numeric, finish_members integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  members as (
    select m.user_id from public.club_members m where m.club = p_club and m.deleted_at is null
  )
  select e.id, e.finished_at, e.rating, e.review,
    p.id, p.username, p.display_name, p.avatar_url,
    t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path,
    (select count(*)::int from public.stamps s where s.entry_id = e.id and s.deleted_at is null),
    exists (select 1 from public.stamps s, me where s.entry_id = e.id and s.user_id = me.id and s.deleted_at is null),
    c.id, c.image_path, e.finish_share, e.finish_members
  from members
  join public.entries e on e.user_id = members.user_id
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
    and private.title_fits(t.kind, t.genres, t.original_language, p_kinds, p_genres, p_languages)
  order by e.finished_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.club_feed(text, text[], text[], text[], integer) from public;
grant execute on function public.club_feed(text, text[], text[], text[], integer) to anon, authenticated;

drop function public.title_reviews(uuid, integer);
create function public.title_reviews(p_title_id uuid, p_limit integer default 20)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text,
  finish_share numeric, finish_members integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id)
  select e.id, e.finished_at, e.rating, e.review,
    p.id, p.username, p.display_name, p.avatar_url,
    t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path,
    (select count(*)::int from public.stamps s where s.entry_id = e.id and s.deleted_at is null),
    exists (select 1 from public.stamps s, me where s.entry_id = e.id and s.user_id = me.id and s.deleted_at is null),
    c.id, c.image_path, e.finish_share, e.finish_members
  from public.entries e
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
  where e.title_id = p_title_id
    and e.status = 'finished'
    and e.deleted_at is null
    and e.review is not null
    and btrim(e.review) <> ''
    and e.finished_at <= now() + interval '1 day'
    and p.username is not null
    and (e.user_id = me.id or (p.visibility = 'public' and not private.is_blocked_between(e.user_id, me.id)))
  order by e.finished_at desc, e.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke execute on function public.title_reviews(uuid, integer) from public, anon;
grant execute on function public.title_reviews(uuid, integer) to authenticated;
