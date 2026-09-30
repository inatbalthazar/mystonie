-- Stage 3 Finisher #N and trending (docs/product/features/S3-finishers-board.md, ADR 0039).
-- Everyone who finishes a title gets the next number for it ("Finisher #1,204"), for good: un-finishing, deleting
-- the entry or finishing it again keeps the same number. Numbers are handed out in the database, one title at a
-- time, so two people finishing at the same moment can never get the same one or leave a gap.

-- ---------------------------------------------------------------------------
-- title_finish_counts: how many people ever finished a title (the last number handed out). Its row is also the
-- lock that serializes numbering for that title.
-- ---------------------------------------------------------------------------
create table public.title_finish_counts (
  title_id   uuid primary key references public.titles (id) on delete cascade,
  finishers  integer not null default 0 check (finishers >= 0),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- title_finishers: who got which number. Permanent (no soft delete); goes with the account or the title.
-- ---------------------------------------------------------------------------
create table public.title_finishers (
  title_id   uuid not null references public.titles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  number     integer not null check (number > 0),
  created_at timestamptz not null default now(),
  primary key (title_id, user_id),
  constraint title_finishers_number_once unique (title_id, number)
);

create index title_finishers_user_id on public.title_finishers (user_id);

-- The entry carries its number, so every read (collection, feed, profile, cards) gets it without a join.
alter table public.entries add column finisher_no integer check (finisher_no > 0);

-- The user's number for a title, handing out the next one the first time. Race-free: after the fast path, the
-- title's counter row is locked, the ledger is checked again (another request of the same user may have won), and
-- only then is the next number taken.
create function private.finisher_number(p_title_id uuid, p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select number into n from public.title_finishers where title_id = p_title_id and user_id = p_user_id;
  if found then
    return n;
  end if;

  insert into public.title_finish_counts (title_id) values (p_title_id) on conflict (title_id) do nothing;
  select finishers into n from public.title_finish_counts where title_id = p_title_id for update;

  -- A fresh snapshot after the lock: a request that held it may have just numbered this user.
  select number into n from public.title_finishers where title_id = p_title_id and user_id = p_user_id;
  if found then
    return n;
  end if;

  update public.title_finish_counts
  set finishers = finishers + 1, updated_at = now()
  where title_id = p_title_id
  returning finishers into n;
  insert into public.title_finishers (title_id, user_id, number) values (p_title_id, p_user_id, n);
  return n;
end;
$$;

revoke execute on function private.finisher_number(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Existing finishes get numbers in the order they were finished (then added), before the trigger exists.
-- ---------------------------------------------------------------------------
with numbered as (
  select e.id, e.title_id, e.user_id,
    row_number() over (partition by e.title_id order by e.finished_at, e.created_at, e.id)::int as number
  from public.entries e
  where e.status = 'finished' and e.deleted_at is null
),
ledger as (
  insert into public.title_finishers (title_id, user_id, number)
  select title_id, user_id, number from numbered
  returning title_id, number
),
counts as (
  insert into public.title_finish_counts (title_id, finishers)
  select title_id, max(number) from ledger group by title_id
  returning title_id
)
update public.entries e
set finisher_no = n.number
from numbered n
where e.id = n.id;

-- Every write of an entry: a live finish without a number gets its number (its old one when this person finished
-- the title before). The number itself can't be set by a request: clients have no grant on it, and the trigger
-- overwrites whatever the service role sends.
create function private.assign_finisher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.finisher_no := case when tg_op = 'UPDATE' then old.finisher_no end;
  if new.status = 'finished' and new.deleted_at is null and new.finisher_no is null then
    new.finisher_no := private.finisher_number(new.title_id, new.user_id);
  end if;
  return new;
end;
$$;

revoke execute on function private.assign_finisher() from public, anon, authenticated;

create trigger entries_assign_finisher
  before insert or update on public.entries
  for each row execute function private.assign_finisher();

-- ---------------------------------------------------------------------------
-- RLS: counts are public (a title page shows them to anyone); the ledger only to its owner (the data export).
-- Nobody writes either except the functions above.
-- ---------------------------------------------------------------------------
alter table public.title_finish_counts enable row level security;
alter table public.title_finishers enable row level security;

create policy "finisher counts are readable" on public.title_finish_counts for select to anon, authenticated
  using (true);
create policy "users read their finisher numbers" on public.title_finishers for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.title_finish_counts, public.title_finishers from anon;
revoke insert, update, delete, truncate, references, trigger on public.title_finish_counts, public.title_finishers from authenticated;
grant select on public.title_finish_counts to anon, authenticated;
grant select on public.title_finishers to authenticated;

-- ---------------------------------------------------------------------------
-- Trending on Mystonie: the titles most people finished, watched or read lately. Counts only, never who: a title
-- shows only once at least 3 different people were on it (private profiles count, anonymously), so no single
-- person's activity can be read from it.
-- ---------------------------------------------------------------------------
create index entries_finished_at on public.entries (finished_at) where status = 'finished' and deleted_at is null;
create index episode_logs_watched_at on public.episode_logs (watched_at) where deleted_at is null;
create index reading_logs_read_at on public.reading_logs (read_at) where deleted_at is null;

create function public.trending_titles(p_days integer default 7, p_limit integer default 12)
returns table (
  title_id uuid, kind text, source text, external_id text, name text, year integer, poster_path text,
  people integer, finishers integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 31)) as since,
      now() + interval '1 day' as until
  ),
  activity as (
    select e.title_id, e.user_id, true as finished
    from public.entries e, w
    where e.status = 'finished' and e.deleted_at is null and e.finished_at >= w.since and e.finished_at <= w.until
    union all
    select l.title_id, l.user_id, false
    from public.episode_logs l, w
    where l.deleted_at is null and l.watched_at >= w.since and l.watched_at <= w.until
    union all
    select r.title_id, r.user_id, false
    from public.reading_logs r, w
    where r.deleted_at is null and r.read_at >= w.since and r.read_at <= w.until
  ),
  ranked as (
    select a.title_id,
      count(distinct a.user_id)::int as people,
      (count(distinct a.user_id) filter (where a.finished))::int as finishers
    from activity a
    group by a.title_id
    having count(distinct a.user_id) >= 3
  )
  select t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path, r.people, r.finishers
  from ranked r
  join public.titles t on t.id = r.title_id
  order by r.people desc, r.finishers desc, t.name, t.id
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke execute on function public.trending_titles(integer, integer) from public;
grant execute on function public.trending_titles(integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The Following feed also returns each finish's number (unchanged otherwise, ADR 0037).
-- ---------------------------------------------------------------------------
drop function public.following_feed(timestamptz, uuid, integer);
create function public.following_feed(p_before timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (
  entry_id uuid, finished_at timestamptz, rating numeric, review text,
  user_id uuid, username text, display_name text, avatar_url text,
  title_id uuid, title_kind text, title_source text, title_external_id text, title_name text, title_year integer,
  poster_path text, stamp_count integer, stamped boolean, card_id uuid, card_image_path text, finisher_no integer
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
    c.id, c.image_path, e.finisher_no
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
