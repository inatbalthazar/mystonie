-- Stage 2: content warnings from DoesTheDogDie (docs/product/features/S2-content-warnings.md, ADR 0009, ADR 0035).
-- DTDD's per-title yes/no votes are cached here by our server (service role) and refreshed after 7 days; users
-- pick the topics they want to avoid, and the collection and search flag titles with a Yes for one of them.

-- The DTDD item a movie or series matched (null: none yet, or no confident match) and when we last looked it up.
alter table public.titles
  add column dtdd_id integer check (dtdd_id > 0),
  add column dtdd_checked_at timestamptz;

-- One row per topic anyone voted on for the title. DTDD's terms allow caching only to improve performance and
-- ask for a refresh at least every 30 days: rows are rewritten after 7 days, when someone opens the title.
create table public.title_warnings (
  title_id   uuid not null references public.titles (id) on delete cascade,
  topic_id   integer not null check (topic_id > 0 and topic_id <= 100000),
  topic_name text not null check (char_length(topic_name) between 1 and 200),
  category   text not null check (char_length(category) between 1 and 80),
  -- DTDD marks topics whose answer gives the plot away; the title page hides them until tapped.
  spoiler    boolean not null default false,
  yes_count  integer not null check (yes_count >= 0),
  no_count   integer not null check (no_count >= 0),
  -- DTDD's top comment for the topic, shown only after a tap.
  comment    text check (char_length(comment) <= 500),
  fetched_at timestamptz not null default now(),
  primary key (title_id, topic_id)
);

alter table public.title_warnings enable row level security;

-- Public catalog data, like `titles`: readable by everyone, written only by the server (service role).
create policy "title warnings are readable by everyone"
  on public.title_warnings for select
  to anon, authenticated
  using (true);

-- The topics a user wants to be warned about (DTDD topic ids). User rows, so the day-one rules apply as for
-- entries (ADR 0021): client-style UUID v7 ids, a server-stamped updated_at, soft delete (unticking a topic sets
-- deleted_at, which future offline sync needs as a tombstone), no client DELETE.
create table public.user_avoid_topics (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  topic_id   integer not null check (topic_id > 0 and topic_id <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- A topic is chosen once while it's live.
create unique index user_avoid_topics_one_active_per_topic
  on public.user_avoid_topics (user_id, topic_id) where deleted_at is null;
create index user_avoid_topics_user_id_updated_at on public.user_avoid_topics (user_id, updated_at);

create trigger user_avoid_topics_set_updated_at
  before update on public.user_avoid_topics
  for each row execute function public.set_updated_at();

alter table public.user_avoid_topics enable row level security;

-- Private: which topics someone avoids can say a lot about them, so only the owner ever sees them (no public-profile
-- policy, unlike entries).
create policy "owners read their avoid topics" on public.user_avoid_topics for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners add avoid topics" on public.user_avoid_topics for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners update their avoid topics" on public.user_avoid_topics for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.user_avoid_topics from anon;
revoke insert, update, delete on public.user_avoid_topics from authenticated;
grant insert (id, user_id, topic_id) on public.user_avoid_topics to authenticated;
grant update (deleted_at) on public.user_avoid_topics to authenticated;

-- DTDD has about 300 topics; more live rows than that is someone scripting the API.
create function private.limit_avoid_topics()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.deleted_at is null
     and (select count(*) from public.user_avoid_topics
          where user_id = new.user_id and deleted_at is null and id <> new.id) >= 500 then
    raise exception 'too many avoid topics' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger user_avoid_topics_limit
  before insert or update of deleted_at on public.user_avoid_topics
  for each row execute function private.limit_avoid_topics();

-- The caller's avoid-topics that `p_title_ids` have votes leaning yes on (the app applies the full Yes rule):
-- the collection's and search results' warning badges. Cached data only; it never calls DTDD.
create function public.avoid_warnings(p_title_ids uuid[])
returns table (title_id uuid, topic_id integer, topic_name text, yes_count integer, no_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select w.title_id, w.topic_id, w.topic_name, w.yes_count, w.no_count
  from public.title_warnings w
  join public.user_avoid_topics a
    on a.topic_id = w.topic_id and a.user_id = (select auth.uid()) and a.deleted_at is null
  where w.title_id = any (p_title_ids)
    and w.yes_count > w.no_count
$$;

revoke all on function public.avoid_warnings(uuid[]) from public, anon;
grant execute on function public.avoid_warnings(uuid[]) to authenticated;
