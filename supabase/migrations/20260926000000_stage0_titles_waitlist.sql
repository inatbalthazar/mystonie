-- Stage 0: TMDB title cache, waitlist and rate limits.
-- Data model: docs/architecture/data-model.md. RLS on every table.

-- Shared trigger: server-stamps updated_at on every UPDATE (clients can't forge it).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- titles: cache of catalog items (TMDB now; Google Books / AniList in stage 2).
-- Readable by everyone, written only by our route handlers (service role).
-- ---------------------------------------------------------------------------
create table public.titles (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('movie', 'series', 'book', 'manga')),
  source            text not null check (source in ('tmdb', 'google_books', 'anilist')),
  external_id       text not null,
  name              text not null,
  original_name     text,
  original_language text,
  year              smallint check (year between 1800 and 2200),
  poster_path       text,
  palette           jsonb,
  genres            text[] not null default '{}',
  runtime_min       integer check (runtime_min >= 0),
  episode_count     integer check (episode_count >= 0),
  season_count      integer check (season_count >= 0),
  raw               jsonb,
  fetched_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (source, external_id)
);

create trigger titles_set_updated_at
  before update on public.titles
  for each row execute function public.set_updated_at();

alter table public.titles enable row level security;

create policy "titles are readable by everyone"
  on public.titles for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- waitlist: emails for the collection app launch. Inserted only through our
-- route handler (honeypot + rate limit), never read by clients.
-- ---------------------------------------------------------------------------
create table public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (email = lower(btrim(email)) and email like '%_@_%' and length(email) <= 320),
  locale          text not null default 'en',
  source          text,
  consent_at      timestamptz not null,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (email)
);

create trigger waitlist_set_updated_at
  before update on public.waitlist
  for each row execute function public.set_updated_at();

-- RLS on with no policies: only the service role (server) can touch it.
alter table public.waitlist enable row level security;

-- ---------------------------------------------------------------------------
-- rate_limits: fixed-window counters keyed by e.g. 'search:<salted ip hash>'.
-- Server only. No raw IPs are ever stored.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0 check (count >= 0),
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;

-- Atomically counts one hit and returns true while the caller is within the limit.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  return v_count <= p_max;
end;
$$;

-- Old windows are useless after they close. Called opportunistically by the server (or pg_cron later).
create or replace function public.rate_limits_prune()
returns void
language sql
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.rate_limits_prune() from public, anon, authenticated;
