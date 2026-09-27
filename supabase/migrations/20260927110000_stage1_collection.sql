-- Stage 1 collection: entries, episode logs, the TMDB episode cache and saved cards.
-- Data model: docs/architecture/data-model.md.
-- Day-one rules for user tables (AGENTS.md):
--   * the client generates the id as a UUID v7 (checked here);
--   * the server stamps updated_at (set_updated_at trigger);
--   * a row is removed by setting deleted_at (soft delete), never with DELETE from a client.
-- Every user table references profiles(id) on delete cascade, so deleting an account removes it all (ADR 0020).

-- Visibility check for RLS policies. It is security definer because profiles are readable by their owner only.
-- It lives in a schema the API doesn't expose, so it can't be called as an RPC.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_public_profile(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = uid and visibility = 'public');
$$;

revoke execute on function private.is_public_profile(uuid) from public;
grant execute on function private.is_public_profile(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- entries: one per (user, title) while not deleted (re-watches: open question Q1).
-- ---------------------------------------------------------------------------
create table public.entries (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title_id    uuid not null references public.titles (id),
  status      text not null check (status in ('want', 'watching', 'finished')),
  finished_at timestamptz,
  rating      numeric(2, 1) check (rating between 0.5 and 5 and rating * 2 = trunc(rating * 2)),
  review      text check (char_length(review) between 1 and 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Only finished entries have a finish date (stats count them by it).
  constraint entries_finished_at_matches_status check ((status = 'finished') = (finished_at is not null)),
  -- Lets cards reference (entry, owner), so a card can only point at its owner's entry.
  constraint entries_id_user_id_key unique (id, user_id)
);

create unique index entries_one_active_per_title on public.entries (user_id, title_id) where deleted_at is null;
create index entries_user_id_updated_at on public.entries (user_id, updated_at);  -- sync pulls, owner lists
create index entries_title_id on public.entries (title_id);

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- episode_logs: one row per watched episode. runtime_min is copied at log time.
-- ---------------------------------------------------------------------------
create table public.episode_logs (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title_id    uuid not null references public.titles (id),
  season      smallint not null check (season >= 0),  -- 0 = specials, as on TMDB
  episode     smallint not null check (episode >= 0),
  runtime_min integer check (runtime_min between 0 and 1440),
  watched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  constraint episode_logs_id_user_id_key unique (id, user_id)
);

create unique index episode_logs_one_active_per_episode
  on public.episode_logs (user_id, title_id, season, episode) where deleted_at is null;
create index episode_logs_user_id_updated_at on public.episode_logs (user_id, updated_at);
create index episode_logs_title_id on public.episode_logs (title_id);

create trigger episode_logs_set_updated_at
  before update on public.episode_logs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- title_episodes: TMDB season/episode cache. Readable by everyone, written by our route handlers.
-- ---------------------------------------------------------------------------
create table public.title_episodes (
  title_id    uuid not null references public.titles (id) on delete cascade,
  season      smallint not null check (season >= 0),
  episode     smallint not null check (episode >= 0),
  name        text,
  runtime_min integer check (runtime_min between 0 and 1440),
  air_date    date,
  fetched_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (title_id, season, episode)
);

create trigger title_episodes_set_updated_at
  before update on public.title_episodes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- cards: the inputs of a rendered card (re-render, profile gallery, /c/[id] links).
-- The PNG goes to Storage at <user_id>/<card id>.png when shared (share-artwork task).
-- ---------------------------------------------------------------------------
create table public.cards (
  id             uuid primary key check (uuid_extract_version(id) = 7),
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id       uuid,
  episode_log_id uuid,
  kind           text not null check (kind in ('finish', 'progress', 'sticker', 'weekly_recap')),
  template_id    text not null check (template_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  size           text not null check (size in ('story', 'feed')),
  params         jsonb not null default '{}' check (jsonb_typeof(params) = 'object' and pg_column_size(params) <= 16384),
  image_path     text,
  shared_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  foreign key (entry_id, user_id) references public.entries (id, user_id) on delete cascade,
  foreign key (episode_log_id, user_id) references public.episode_logs (id, user_id) on delete cascade,
  constraint cards_one_source check (num_nonnulls(entry_id, episode_log_id) <= 1),
  constraint cards_finish_has_entry check (kind <> 'finish' or entry_id is not null),
  constraint cards_recap_has_no_source check (kind <> 'weekly_recap' or num_nonnulls(entry_id, episode_log_id) = 0),
  constraint cards_image_path_in_own_folder
    check (image_path is null or image_path = user_id::text || '/' || id::text || '.png')
);

create index cards_user_id_updated_at on public.cards (user_id, updated_at);
create index cards_entry_id on public.cards (entry_id, user_id);
create index cards_episode_log_id on public.cards (episode_log_id, user_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.entries enable row level security;
alter table public.episode_logs enable row level security;
alter table public.title_episodes enable row level security;
alter table public.cards enable row level security;

-- Owners see all their rows, deleted ones included (sync needs the tombstones).
-- Everyone else sees live rows of public profiles only (S1 profile & privacy).
create policy "owners read their entries" on public.entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "live entries of public profiles are readable" on public.entries for select to anon, authenticated
  using (deleted_at is null and private.is_public_profile(user_id));
create policy "owners add entries" on public.entries for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners update their entries" on public.entries for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "owners read their episode logs" on public.episode_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "live episode logs of public profiles are readable" on public.episode_logs for select to anon, authenticated
  using (deleted_at is null and private.is_public_profile(user_id));
create policy "owners add episode logs" on public.episode_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners update their episode logs" on public.episode_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "title episodes are readable by everyone" on public.title_episodes for select to anon, authenticated
  using (true);

-- A shared card is an explicit publish: its link works even when the profile is private.
create policy "owners read their cards" on public.cards for select to authenticated
  using (user_id = (select auth.uid()));
create policy "shared cards are readable" on public.cards for select to anon, authenticated
  using (shared_at is not null and deleted_at is null);
create policy "owners add cards" on public.cards for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners update their cards" on public.cards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Column privileges: clients never hard-delete (soft delete only), never move a row to another user or title,
-- and never write the timestamps the server owns. The service role keeps full access.
revoke insert, update, delete on public.entries, public.episode_logs, public.cards, public.title_episodes
  from anon, authenticated;
grant insert (id, user_id, title_id, status, finished_at, rating, review)
  on public.entries to authenticated;
grant update (status, finished_at, rating, review, deleted_at)
  on public.entries to authenticated;
grant insert (id, user_id, title_id, season, episode, runtime_min, watched_at)
  on public.episode_logs to authenticated;
grant update (runtime_min, watched_at, deleted_at)
  on public.episode_logs to authenticated;
grant insert (id, user_id, entry_id, episode_log_id, kind, template_id, size, params, image_path, shared_at)
  on public.cards to authenticated;
grant update (template_id, size, params, image_path, shared_at, deleted_at)
  on public.cards to authenticated;
