-- Stage 2: where to watch by country (docs/product/features/S2-where-to-watch.md, ADR 0032).
-- TMDB's watch providers (data by JustWatch) for a movie or series, every country in one row, refreshed after
-- 24 hours by our route handlers. `profiles.country` (stage 1) says which country a user sees.

create table public.title_providers (
  title_id   uuid primary key references public.titles (id) on delete cascade,
  -- { "US": { "stream": [{ "id": 8, "name": "Netflix", "logo": "/x.png" }], "free": [...], "buy": [...] }, ... }
  providers  jsonb not null check (jsonb_typeof(providers) = 'object' and pg_column_size(providers) <= 262144),
  fetched_at timestamptz not null default now()
);

alter table public.title_providers enable row level security;

-- Public catalog data, like `titles`: readable by everyone, written only by the server (service role).
create policy "title providers are readable by everyone"
  on public.title_providers for select
  to anon, authenticated
  using (true);
