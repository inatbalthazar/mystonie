-- Stage 4: Reel of the Day (docs/product/features/S4-daily-reel.md, ADR 0048). One movie a day (a UTC day) for
-- everyone, six guesses, a clue after each wrong one. The server picks each day's reel from TMDB's best-known movies
-- and grades every guess; signed-in players' plays are kept for streaks and stats. Clients write nothing here.

-- ---------------------------------------------------------------------------
-- daily_reels: the day's movie. Secret while its day runs: clients read only days that are over (yesterday's answer).
-- ---------------------------------------------------------------------------
create table public.daily_reels (
  day        date primary key,
  -- #1 on 2026-09-30 (`reelNumber` in src/core/reel.ts).
  number     integer not null unique check (number > 0),
  title_id   uuid not null references public.titles (id),
  created_at timestamptz not null default now()
);

create index daily_reels_title_id on public.daily_reels (title_id);

alter table public.daily_reels enable row level security;

create policy "past reels are readable" on public.daily_reels for select to anon, authenticated
  using (day < (now() at time zone 'utc')::date);

revoke all on public.daily_reels from anon, authenticated;
grant select on public.daily_reels to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reel_plays: a signed-in player's guesses for a day, graded by the server.
-- ---------------------------------------------------------------------------
create table public.reel_plays (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null references public.daily_reels (day),
  -- `[{ "externalId": "603", "name": "The Matrix" }]`: TMDB movie ids in the order guessed.
  guesses     jsonb not null default '[]' check (jsonb_typeof(guesses) = 'array' and jsonb_array_length(guesses) <= 6),
  solved      boolean not null default false,
  -- Set when the play is over (solved, or six wrong guesses).
  finished_at timestamptz,
  -- Wins in a row after this play (0 when lost); set when it's over.
  streak      integer check (streak >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reel_plays_once unique (user_id, day),
  constraint reel_plays_finished check ((finished_at is null) = (streak is null) and (not solved or finished_at is not null))
);

create index reel_plays_day on public.reel_plays (day);

create trigger reel_plays_set_updated_at
  before update on public.reel_plays
  for each row execute function public.set_updated_at();

alter table public.reel_plays enable row level security;

create policy "players read their plays" on public.reel_plays for select to authenticated
  using (user_id = (select auth.uid()));

-- No client writes: the server grades and records every guess (service role).
revoke all on public.reel_plays from anon;
revoke insert, update, delete, truncate, references, trigger on public.reel_plays from authenticated;
grant select on public.reel_plays to authenticated;

-- ---------------------------------------------------------------------------
-- Reel of the Day cards: the day's result as a strip of film frames, spoiler-free.
-- ---------------------------------------------------------------------------
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review', 'challenge', 'reel'));
