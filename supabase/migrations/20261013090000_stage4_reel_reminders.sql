-- Stage 4: Reel of the Day reminders (ADR 0054). An installed app with notifications on can also get one push on a day
-- whose reel would end a streak of 2 or more wins, a few hours before the reel changes (midnight UTC) and at an hour
-- the player is awake. Off unless the player turns it on in Settings.

alter table public.profiles add column reel_reminders boolean not null default false;
-- The reel day (UTC date) of the last reminder: one a day, however often the hourly job runs. Server-only.
alter table public.profiles add column reel_reminded_on date;

grant update (reel_reminders) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Players whose streak `p_day`'s reel would end: reminders on, a won play the day before with a streak of 2 or more,
-- today's play not finished, not reminded today, and at least one device. One row per player and device, with the
-- player's language and time zone (the job keeps those whose reminder hour it is). Service role only.
-- ---------------------------------------------------------------------------
create or replace function public.reel_reminders_due(p_day date, p_limit integer)
returns table (user_id uuid, locale text, time_zone text, streak integer, subscription_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
set search_path = ''
as $$
  with due as (
    select p.id, p.locale, p.time_zone, y.streak
    from public.profiles p
    join public.reel_plays y on y.user_id = p.id and y.day = p_day - 1 and y.solved and y.streak >= 2
    where p.reel_reminders
      and (p.reel_reminded_on is null or p.reel_reminded_on < p_day)
      and not exists (select 1 from public.reel_plays t where t.user_id = p.id and t.day = p_day and t.finished_at is not null)
      and exists (select 1 from public.push_subscriptions s where s.user_id = p.id)
    order by y.streak desc, p.id
    limit greatest(p_limit, 0)
  )
  select d.id, d.locale, d.time_zone, d.streak, s.id, s.endpoint, s.p256dh, s.auth
  from due d
  join public.push_subscriptions s on s.user_id = d.id
  order by d.streak desc, d.id, s.created_at;
$$;

revoke execute on function public.reel_reminders_due(date, integer) from public, anon, authenticated;
grant execute on function public.reel_reminders_due(date, integer) to service_role;
