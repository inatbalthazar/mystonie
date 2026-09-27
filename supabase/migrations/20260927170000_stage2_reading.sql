-- Stage 2 books & manga (S2 books & manga, ADR 0029): title lengths for reading, reading progress logs, and reading
-- Progress cards. `titles.kind` and `titles.source` already allow book/manga and google_books/anilist (stage 0).

-- ---------------------------------------------------------------------------
-- titles: how long a book or manga is (null while unknown, e.g. a running manga).
-- ---------------------------------------------------------------------------
alter table public.titles
  add column page_count    integer check (page_count >= 0),
  add column chapter_count integer check (chapter_count >= 0),
  add column volume_count  integer check (volume_count >= 0);

-- ---------------------------------------------------------------------------
-- reading_logs: reading checkpoints ("I'm at chapter 1100"), not one row per chapter, so catching up on a long manga
-- is one row. What a log adds is how far it moves past the furthest point logged before it (src/core/collection/
-- reading.ts). A sibling of episode_logs rather than a generalization, so episode_logs stays as it is (open question
-- Q3). Same day-one rules as episode_logs.
-- ---------------------------------------------------------------------------
create table public.reading_logs (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title_id    uuid not null references public.titles (id),
  unit        text not null check (unit in ('page', 'chapter', 'volume')),
  position    integer not null check (position between 1 and 100000),
  read_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Lets cards reference (log, owner), so a card can only point at its owner's log.
  constraint reading_logs_id_user_id_key unique (id, user_id)
);

-- Logging the same point twice is one checkpoint.
create unique index reading_logs_one_active_per_position
  on public.reading_logs (user_id, title_id, unit, position) where deleted_at is null;
create index reading_logs_user_id_updated_at on public.reading_logs (user_id, updated_at);
create index reading_logs_title_id on public.reading_logs (title_id);

create trigger reading_logs_set_updated_at
  before update on public.reading_logs
  for each row execute function public.set_updated_at();

alter table public.reading_logs enable row level security;

create policy "owners read their reading logs" on public.reading_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "live reading logs of public profiles are readable" on public.reading_logs for select to anon, authenticated
  using (deleted_at is null and private.is_public_profile(user_id));
create policy "owners add reading logs" on public.reading_logs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners update their reading logs" on public.reading_logs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke insert, update, delete on public.reading_logs from anon, authenticated;
grant insert (id, user_id, title_id, unit, position, read_at) on public.reading_logs to authenticated;
grant update (read_at, deleted_at) on public.reading_logs to authenticated;

-- ---------------------------------------------------------------------------
-- cards: a reading Progress card points at its reading log (like an episode Progress card at its episode log).
-- ---------------------------------------------------------------------------
alter table public.cards add column reading_log_id uuid;
alter table public.cards
  add constraint cards_reading_log_id_user_id_fkey
  foreign key (reading_log_id, user_id) references public.reading_logs (id, user_id) on delete cascade;
create index cards_reading_log_id on public.cards (reading_log_id, user_id);

alter table public.cards drop constraint cards_one_source;
alter table public.cards add constraint cards_one_source
  check (num_nonnulls(entry_id, episode_log_id, reading_log_id) <= 1);

alter table public.cards drop constraint cards_recap_has_no_source;
alter table public.cards add constraint cards_recap_has_no_source
  check (kind not in ('weekly_recap', 'stats') or num_nonnulls(entry_id, episode_log_id, reading_log_id) = 0);

grant insert (reading_log_id) on public.cards to authenticated;
