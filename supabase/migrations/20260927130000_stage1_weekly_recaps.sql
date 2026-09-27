-- Stage 1 Weekly Recap (S1 share artwork, ADR 0025).
-- Every hour pg_cron asks the app (POST /api/cron/weekly-recaps, bearer CRON_SECRET) to create the recaps that
-- are due: users whose local time is Monday 09:00 or later and who watched something in the week before
-- (Monday–Sunday, their time zone). The route computes the numbers (src/core/stats/recap.ts), stores them
-- here and emails a link to the recap card, which renders in the browser (ADR 0008).

-- Account emails can be switched off (the recap email's unsubscribe link, and Settings).
alter table public.profiles add column email_recaps boolean not null default true;
grant update (email_recaps) on public.profiles to authenticated;

create table public.weekly_recaps (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- The Monday the week starts on, in the user's time zone when the recap was made.
  week_start  date not null check (extract(isodow from week_start) = 1),
  -- The CardRecap snapshot (totals + collage), validated by parseRecap when read.
  stats       jsonb not null check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) <= 16384),
  -- The card the user made from it, if any (set by POST /api/cards).
  card_id     uuid references public.cards (id) on delete set null,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

create index weekly_recaps_unnotified on public.weekly_recaps (created_at) where notified_at is null;
create index weekly_recaps_card_id on public.weekly_recaps (card_id);

alter table public.weekly_recaps enable row level security;

create policy "owners read their recaps" on public.weekly_recaps for select to authenticated
  using (user_id = (select auth.uid()));

-- Only the server (service role) writes recaps.
revoke insert, update, delete on public.weekly_recaps from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Users due a recap at p_now: local Monday from 09:00, no recap yet for the week before, and something
-- watched in it (an episode logged or a title finished). `timestamp at time zone` turns the local week
-- bounds into instants, DST included. Service role only.
-- ---------------------------------------------------------------------------
create or replace function public.weekly_recap_candidates(p_now timestamptz, p_limit integer)
returns table (user_id uuid, time_zone text, week_start date)
language sql
stable
set search_path = ''
as $$
  select p.id, p.time_zone, w.week_start
  from public.profiles p
  cross join lateral (select p_now at time zone p.time_zone as local_now) l
  cross join lateral (select (l.local_now::date - 7) as week_start) w
  cross join lateral (
    select w.week_start::timestamp at time zone p.time_zone as t0,
           (w.week_start + 7)::timestamp at time zone p.time_zone as t1
  ) r
  where extract(isodow from l.local_now) = 1
    and extract(hour from l.local_now) >= 9
    and not exists (select 1 from public.weekly_recaps x where x.user_id = p.id and x.week_start = w.week_start)
    and (
      exists (
        select 1 from public.episode_logs e
        where e.user_id = p.id and e.deleted_at is null and e.watched_at >= r.t0 and e.watched_at < r.t1
      )
      or exists (
        select 1 from public.entries e
        where e.user_id = p.id and e.deleted_at is null and e.status = 'finished'
          and e.finished_at >= r.t0 and e.finished_at < r.t1
      )
    )
  order by p.id
  limit greatest(p_limit, 0);
$$;

-- Recaps whose email hasn't gone out (made in the last 2 days, so a long outage doesn't send stale weeks),
-- for people who kept recap emails on. Reads auth.users for the address, hence security definer.
create or replace function public.weekly_recaps_to_notify(p_limit integer)
returns table (id uuid, user_id uuid, email text, locale text, week_start date, stats jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, u.email::text, p.locale, r.week_start, r.stats
  from public.weekly_recaps r
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  where r.notified_at is null
    and r.created_at > now() - interval '2 days'
    and p.email_recaps
    and u.email is not null
  order by r.created_at, r.id
  limit greatest(p_limit, 0);
$$;

revoke execute on function public.weekly_recap_candidates(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.weekly_recaps_to_notify(integer) from public, anon, authenticated;
grant execute on function public.weekly_recap_candidates(timestamptz, integer) to service_role;
grant execute on function public.weekly_recaps_to_notify(integer) to service_role;

-- ---------------------------------------------------------------------------
-- The hourly call. The app URL and the cron secret live in Supabase Vault, set once per environment
-- (never in a migration):
--   select vault.create_secret('https://mystonie.app', 'app_url');
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- Without them the job does nothing. pg_net sends the request after the job's transaction commits.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create or replace function private.request_weekly_recaps()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'app_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/weekly-recaps',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function private.request_weekly_recaps() from public, anon, authenticated;

-- Minute 5 of every hour: each zone reaches Monday 09:00 at some hour (zones with :30/:45 offsets at 09:35
-- or 09:50). Later hours of the same Monday pick up anything a failed run missed.
select cron.schedule('weekly-recaps', '5 * * * *', $$select private.request_weekly_recaps()$$);
