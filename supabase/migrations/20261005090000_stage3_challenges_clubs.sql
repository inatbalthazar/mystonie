-- Stage 3 challenges and clubs (docs/product/features/S3-challenges-clubs.md, ADR 0040).
-- Monthly challenges: the lineup and its rules live in code (src/core/challenges.ts); a row here says someone joined
-- one, and the server alone writes how far along they are and when they completed it.
-- Fandom clubs: the catalogue and each club's title filter live in code (src/core/clubs.ts); a row here is a
-- membership. Both tables follow the day-one rules (UUID v7, server-stamped updated_at, soft delete, no client DELETE).

-- ---------------------------------------------------------------------------
-- challenge_joins: one person in one month's challenge.
-- ---------------------------------------------------------------------------
create table public.challenge_joins (
  id           uuid primary key check (uuid_extract_version(id) = 7),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The calendar month (its 1st) in the joiner's time zone, and the challenge's slug in that month's lineup.
  month        date not null check (extract(day from month) = 1),
  slug         text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  -- Written by the server only (the check after every save): progress towards the target, and when it was met.
  progress     integer not null default 0 check (progress >= 0 and progress <= 100000),
  completed_at timestamptz,
  -- The title whose save completed it (the card's poster), if it is still in the catalogue.
  title_id     uuid references public.titles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  constraint challenge_joins_completed_live check (completed_at is null or deleted_at is null)
);

create unique index challenge_joins_one_live on public.challenge_joins (user_id, month, slug) where deleted_at is null;
create index challenge_joins_month_slug on public.challenge_joins (month, slug) where deleted_at is null;
create index challenge_joins_user_id_updated_at on public.challenge_joins (user_id, updated_at);
create index challenge_joins_title_id on public.challenge_joins (title_id);

create trigger challenge_joins_set_updated_at
  before update on public.challenge_joins
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- club_members: one person in one fandom club.
-- ---------------------------------------------------------------------------
create table public.club_members (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  club       text not null check (club ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(club) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index club_members_one_live on public.club_members (user_id, club) where deleted_at is null;
create index club_members_club on public.club_members (club, created_at desc) where deleted_at is null;
create index club_members_user_id_updated_at on public.club_members (user_id, updated_at);

create trigger club_members_set_updated_at
  before update on public.club_members
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS and column grants
-- ---------------------------------------------------------------------------
alter table public.challenge_joins enable row level security;
alter table public.club_members enable row level security;

-- The owner reads all of theirs (left ones too, for sync); everyone reads the live ones of a public, unblocked
-- profile (friends' progress on /challenges, patches and clubs on profiles).
create policy "users read their challenge joins" on public.challenge_joins for select to authenticated
  using (user_id = (select auth.uid()));
create policy "challenge joins of public profiles are readable" on public.challenge_joins for select to anon, authenticated
  using (deleted_at is null and private.is_public_profile(user_id));
-- Joining: only around the current month (a local month is at most a day off UTC's; the route checks the lineup).
create policy "users join challenges" on public.challenge_joins for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and month >= (date_trunc('month', now() at time zone 'UTC') - interval '1 month')::date
    and month <= (date_trunc('month', now() at time zone 'UTC') + interval '1 month')::date
  );
-- Leaving is a soft delete, and only before completing: a completed challenge's patch is kept for good.
create policy "users leave challenges" on public.challenge_joins for update to authenticated
  using (user_id = (select auth.uid()) and completed_at is null)
  with check (user_id = (select auth.uid()));

create policy "users read their clubs" on public.club_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy "club members of public profiles are readable" on public.club_members for select to anon, authenticated
  using (deleted_at is null and private.is_public_profile(user_id));
create policy "users join clubs" on public.club_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "users leave clubs" on public.club_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.challenge_joins, public.club_members from anon;
revoke insert, update, delete, truncate, references, trigger on public.challenge_joins, public.club_members from authenticated;
grant select on public.challenge_joins, public.club_members to anon, authenticated;
-- progress, completed_at and title_id are the server's (service role) alone.
grant insert (id, user_id, month, slug) on public.challenge_joins to authenticated;
grant update (deleted_at) on public.challenge_joins to authenticated;
grant insert (id, user_id, club) on public.club_members to authenticated;
grant update (deleted_at) on public.club_members to authenticated;

-- ---------------------------------------------------------------------------
-- Totals. Security definer so private members count too; they return numbers, never who.
-- ---------------------------------------------------------------------------

-- How many people joined and completed each of a month's challenges.
create function public.challenge_counts(p_month date)
returns table (slug text, joined integer, completed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select j.slug, count(*)::int, (count(*) filter (where j.completed_at is not null))::int
  from public.challenge_joins j
  where j.month = p_month and j.deleted_at is null
  group by j.slug;
$$;

revoke execute on function public.challenge_counts(date) from public;
grant execute on function public.challenge_counts(date) to anon, authenticated;

-- How many people are in each club.
create function public.club_counts()
returns table (club text, members integer)
language sql
stable
security definer
set search_path = ''
as $$
  select m.club, count(*)::int from public.club_members m where m.deleted_at is null group by m.club;
$$;

revoke execute on function public.club_counts() from public;
grant execute on function public.club_counts() to anon, authenticated;

-- Whether a title fits a club's filter (any of the kinds, any of the genres, any of the original languages; an
-- empty list doesn't filter). Genres are compared in lower case, as src/core/taste.ts spells them.
create function private.title_fits(
  p_kind text, p_genres text[], p_language text, f_kinds text[], f_genres text[], f_languages text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (coalesce(cardinality(f_kinds), 0) = 0 or p_kind = any(f_kinds))
    and (coalesce(cardinality(f_genres), 0) = 0
         or exists (select 1 from unnest(p_genres) g where lower(trim(g)) = any(f_genres)))
    and (coalesce(cardinality(f_languages), 0) = 0 or lower(p_language) = any(f_languages));
$$;

revoke execute on function private.title_fits(text, text[], text, text[], text[], text[]) from public, anon, authenticated;

-- A club's page: the latest finishes of its members' titles that fit the club, newest first, as Following feed rows
-- (the caller's own, and those of public, unblocked members). The filter comes from the club catalogue in code;
-- any filter only ever shows what those profiles already show.
create function public.club_feed(
  p_club text, p_kinds text[] default null, p_genres text[] default null, p_languages text[] default null,
  p_limit integer default 20
)
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
  members as (
    select m.user_id from public.club_members m where m.club = p_club and m.deleted_at is null
  )
  select e.id, e.finished_at, e.rating, e.review,
    p.id, p.username, p.display_name, p.avatar_url,
    t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path,
    (select count(*)::int from public.stamps s where s.entry_id = e.id and s.deleted_at is null),
    exists (select 1 from public.stamps s, me where s.entry_id = e.id and s.user_id = me.id and s.deleted_at is null),
    c.id, c.image_path, e.finisher_no
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

-- What a club's members were on lately (finishes, episode and reading logs of titles that fit the club), by how
-- many members. Like trending_titles: private members count, and a title shows only from 3 people (fixed here).
create function public.club_trending(
  p_club text, p_kinds text[] default null, p_genres text[] default null, p_languages text[] default null,
  p_days integer default 30, p_limit integer default 6
)
returns table (
  title_id uuid, kind text, source text, external_id text, name text, year integer, poster_path text, people integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with w as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 31)) as since,
      now() + interval '1 day' as until
  ),
  members as (
    select m.user_id from public.club_members m where m.club = p_club and m.deleted_at is null
  ),
  activity as (
    select e.title_id, e.user_id
    from public.entries e join members using (user_id), w
    where e.status = 'finished' and e.deleted_at is null and e.finished_at >= w.since and e.finished_at <= w.until
    union all
    select l.title_id, l.user_id
    from public.episode_logs l join members using (user_id), w
    where l.deleted_at is null and l.watched_at >= w.since and l.watched_at <= w.until
    union all
    select r.title_id, r.user_id
    from public.reading_logs r join members using (user_id), w
    where r.deleted_at is null and r.read_at >= w.since and r.read_at <= w.until
  ),
  ranked as (
    select a.title_id, count(distinct a.user_id)::int as people
    from activity a
    group by a.title_id
    having count(distinct a.user_id) >= 3
  )
  select t.id, t.kind, t.source, t.external_id, t.name, t.year, t.poster_path, r.people
  from ranked r
  join public.titles t on t.id = r.title_id
  where private.title_fits(t.kind, t.genres, t.original_language, p_kinds, p_genres, p_languages)
  order by r.people desc, t.name, t.id
  limit least(greatest(coalesce(p_limit, 6), 1), 24);
$$;

revoke execute on function public.club_trending(text, text[], text[], text[], integer, integer) from public;
grant execute on function public.club_trending(text, text[], text[], text[], integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Challenge cards: the month's calendar page with the challenge completed.
-- ---------------------------------------------------------------------------
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review', 'challenge'));
