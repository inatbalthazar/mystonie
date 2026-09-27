-- Stage 1 Home + PWA: web push for the Weekly Recap (ADR 0028).
-- An installed app that turns on notifications stores its push subscription here (POST /api/push, service role).
-- The hourly recap job (ADR 0025) then pushes each new recap to the user's devices once.

-- ---------------------------------------------------------------------------
-- push_subscriptions: one row per browser/device subscription. Server-only, like reports: the route handler
-- verifies the user and writes with the service role (a device can move to another account, which a client
-- upsert under RLS couldn't do). Rows are device tokens, not user content, so they are deleted, not soft
-- deleted: on unsubscribe, when the push service says the subscription is gone, and with the account.
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- The push service URL (checked against the known services in src/core/push.ts before it is stored).
  endpoint    text not null unique check (char_length(endpoint) between 1 and 1024),
  -- The browser's P-256 public key and auth secret (base64url), used to encrypt each message.
  p256dh      text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth        text not null check (auth ~ '^[A-Za-z0-9_-]{22}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index push_subscriptions_user_id on public.push_subscriptions (user_id);

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Each recap is pushed once (independently of the email, which has its own opt-out).
-- ---------------------------------------------------------------------------
alter table public.weekly_recaps add column pushed_at timestamptz;

create index weekly_recaps_unpushed on public.weekly_recaps (created_at) where pushed_at is null;

-- Recaps not pushed yet (made in the last 2 days, like emails) for users with at least one subscription,
-- one row per recap and subscription. Service role only.
create or replace function public.weekly_recaps_to_push(p_limit integer)
returns table (id uuid, user_id uuid, locale text, stats jsonb, subscription_id uuid, endpoint text, p256dh text, auth text)
language sql
stable
set search_path = ''
as $$
  with due as (
    select r.id, r.user_id, r.stats, r.created_at
    from public.weekly_recaps r
    where r.pushed_at is null
      and r.created_at > now() - interval '2 days'
      and exists (select 1 from public.push_subscriptions s where s.user_id = r.user_id)
    order by r.created_at, r.id
    limit greatest(p_limit, 0)
  )
  select d.id, d.user_id, p.locale, d.stats, s.id, s.endpoint, s.p256dh, s.auth
  from due d
  join public.profiles p on p.id = d.user_id
  join public.push_subscriptions s on s.user_id = d.user_id
  order by d.created_at, d.id, s.created_at;
$$;

revoke execute on function public.weekly_recaps_to_push(integer) from public, anon, authenticated;
grant execute on function public.weekly_recaps_to_push(integer) to service_role;
