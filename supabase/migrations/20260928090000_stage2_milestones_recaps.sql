-- Stage 2: Milestone cards, Monthly Recap, Year in Review (S2 milestones & recaps, ADR 0031).
--
-- 1. Three new card kinds. Like recap and stats cards they have no entry, episode or reading log:
--    `milestone` (the 100th title, 1,000 hours, …), `monthly_recap` and `year_review`.
-- 2. `weekly_recaps` also holds monthly recaps (`period`), made by the same hourly job on the user's local
--    1st of the month from 09:00. Both kinds now count reading (a page, chapter or volume logged) as activity.
-- 3. `profiles.milestones_seen`: the highest milestone announced per metric, so each is celebrated once.

-- ---------------------------------------------------------------------------
-- 1. Card kinds
-- ---------------------------------------------------------------------------
alter table public.cards drop constraint cards_kind_check;
alter table public.cards add constraint cards_kind_check
  check (kind in ('finish', 'progress', 'sticker', 'weekly_recap', 'stats', 'milestone', 'monthly_recap', 'year_review'));

alter table public.cards drop constraint cards_recap_has_no_source;
alter table public.cards add constraint cards_recap_has_no_source
  check (
    kind not in ('weekly_recap', 'monthly_recap', 'stats', 'milestone', 'year_review')
    or num_nonnulls(entry_id, episode_log_id, reading_log_id) = 0
  );

-- ---------------------------------------------------------------------------
-- 2. Monthly recaps: same table, same notify/push functions (the stats snapshot carries `period: "month"`).
-- ---------------------------------------------------------------------------
alter table public.weekly_recaps add column period text not null default 'week' check (period in ('week', 'month'));

-- `week_start` is now the period's first local day: a Monday for a week, the 1st for a month.
alter table public.weekly_recaps drop constraint weekly_recaps_week_start_check;
alter table public.weekly_recaps add constraint weekly_recaps_period_start_check
  check ((period = 'week' and extract(isodow from week_start) = 1) or (period = 'month' and extract(day from week_start) = 1));

alter table public.weekly_recaps drop constraint weekly_recaps_user_id_week_start_key;
alter table public.weekly_recaps add constraint weekly_recaps_user_period_start_key unique (user_id, period, week_start);

-- Something happened in [t0, t1): an episode logged, a title finished or reading logged.
create or replace function private.active_between(p_user uuid, p_t0 timestamptz, p_t1 timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
      select 1 from public.episode_logs e
      where e.user_id = p_user and e.deleted_at is null and e.watched_at >= p_t0 and e.watched_at < p_t1
    )
    or exists (
      select 1 from public.entries e
      where e.user_id = p_user and e.deleted_at is null and e.status = 'finished'
        and e.finished_at >= p_t0 and e.finished_at < p_t1
    )
    or exists (
      select 1 from public.reading_logs r
      where r.user_id = p_user and r.deleted_at is null and r.read_at >= p_t0 and r.read_at < p_t1
    );
$$;

revoke execute on function private.active_between(uuid, timestamptz, timestamptz) from public, anon, authenticated;

-- Weekly: as before (local Monday from 09:00, the week before), now with reading as activity.
create or replace function public.weekly_recap_candidates(p_now timestamptz, p_limit integer)
returns table (user_id uuid, time_zone text, week_start date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.time_zone, w.week_start
  from public.profiles p
  cross join lateral (select p_now at time zone p.time_zone as local_now) l
  cross join lateral (select (l.local_now::date - 7) as week_start) w
  where extract(isodow from l.local_now) = 1
    and extract(hour from l.local_now) >= 9
    and not exists (
      select 1 from public.weekly_recaps x where x.user_id = p.id and x.period = 'week' and x.week_start = w.week_start
    )
    and private.active_between(
      p.id,
      w.week_start::timestamp at time zone p.time_zone,
      (w.week_start + 7)::timestamp at time zone p.time_zone
    )
  order by p.id
  limit greatest(p_limit, 0);
$$;

-- Monthly: the user's local 1st of the month from 09:00, for the month before. Service role only.
create or replace function public.monthly_recap_candidates(p_now timestamptz, p_limit integer)
returns table (user_id uuid, time_zone text, month_start date)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.time_zone, m.month_start
  from public.profiles p
  cross join lateral (select p_now at time zone p.time_zone as local_now) l
  cross join lateral (select (date_trunc('month', l.local_now) - interval '1 month')::date as month_start) m
  where extract(day from l.local_now) = 1
    and extract(hour from l.local_now) >= 9
    and not exists (
      select 1 from public.weekly_recaps x where x.user_id = p.id and x.period = 'month' and x.week_start = m.month_start
    )
    and private.active_between(
      p.id,
      m.month_start::timestamp at time zone p.time_zone,
      (m.month_start + interval '1 month')::timestamp at time zone p.time_zone
    )
  order by p.id
  limit greatest(p_limit, 0);
$$;

revoke execute on function public.weekly_recap_candidates(timestamptz, integer) from public, anon, authenticated;
revoke execute on function public.monthly_recap_candidates(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.weekly_recap_candidates(timestamptz, integer) to service_role;
grant execute on function public.monthly_recap_candidates(timestamptz, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Milestones announced so far: { "titles": 100, "hours": 250, "episodes": 500 }. The owner's client
--    writes it through POST /api/milestones (it only decides which celebrations they have seen).
-- ---------------------------------------------------------------------------
alter table public.profiles add column milestones_seen jsonb not null default '{}'::jsonb
  check (jsonb_typeof(milestones_seen) = 'object' and pg_column_size(milestones_seen) <= 1024);
grant update (milestones_seen) on public.profiles to authenticated;
