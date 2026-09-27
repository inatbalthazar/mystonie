-- Stage 1 auth: one profile per auth.users row, created by a trigger on sign-up (ADR 0020).
-- Data model: docs/architecture/data-model.md. Deleting the auth user deletes the profile (cascade);
-- later user tables (entries, episode_logs, cards, …) reference profiles with on delete cascade too.

-- True when Postgres knows the time zone name (IANA names like 'Asia/Bangkok', or 'UTC').
create or replace function public.is_time_zone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if tz is null or tz !~ '^[A-Za-z][A-Za-z0-9_+/-]{0,63}$' then
    return false;
  end if;
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text check (char_length(display_name) between 1 and 50),
  avatar_url   text check (avatar_url ~ '^https://' and char_length(avatar_url) <= 500),
  locale       text not null default 'en' check (locale ~ '^[a-z]{2}$'),
  time_zone    text not null default 'UTC' check (public.is_time_zone(time_zone)),
  country      text check (country ~ '^[A-Z]{2}$'),
  visibility   text not null default 'public' check (visibility in ('public', 'private')),
  theme        text not null default 'system' check (theme in ('system', 'light', 'dark')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Only the owner reads the full row (time zone and locale are personal). Public profile pages
-- will read a safe subset through the server (S1 profile task).
create policy "owners read their profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "owners update their profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Rows are created by the trigger and removed with the auth user, never by clients.
-- Clients may change settings columns only (not id or the timestamps).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, locale, time_zone, country, visibility, theme)
  on public.profiles to authenticated;

-- Names that would collide with routes or impersonate the service. The full blocklist comes with the
-- profile task; this keeps generated usernames off the obvious ones.
create or replace function public.is_reserved_username(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select name = any (array[
    'admin', 'administrator', 'api', 'auth', 'help', 'mystonie', 'stonie', 'root', 'settings', 'support',
    'system', 'privacy', 'terms', 'unsubscribe', 'null', 'undefined', 'www', 'mail', 'official', 'staff'
  ]);
$$;

-- A free username from a display name or email local part: lower-case a–z, 0–9 and _, 3–20 chars.
-- Scripts without Latin letters (e.g. a Thai name) fall back to "stonie" (reserved, so it always gets
-- digits). Taken or reserved → add 4 digits.
create or replace function public.suggest_username(seed text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  base text := trim(both '_' from left(regexp_replace(lower(coalesce(seed, '')), '[^a-z0-9]+', '_', 'g'), 15));
  candidate text;
begin
  if char_length(base) < 3 then
    base := 'stonie';
  end if;
  candidate := base;
  for attempt in 1..20 loop
    if not public.is_reserved_username(candidate)
       and not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    candidate := base || (1000 + floor(random() * 9000))::int::text;
  end loop;
  return 'stonie' || substr(md5(random()::text), 1, 12);
end;
$$;

-- Runs as the table owner when Supabase Auth inserts a user. Sign-up metadata comes from our app:
-- `signup_locale` (the locale of the page the person signed up on) and `signup_time_zone` (browser IANA
-- name). Google users get them right after the OAuth callback instead (see /api/auth/callback).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  name text := nullif(btrim(coalesce(meta ->> 'full_name', meta ->> 'name', '')), '');
  avatar text := meta ->> 'avatar_url';
  signup_locale text := meta ->> 'signup_locale';
  signup_tz text := meta ->> 'signup_time_zone';
begin
  for attempt in 1..5 loop
    insert into public.profiles (id, username, display_name, avatar_url, locale, time_zone)
    values (
      new.id,
      public.suggest_username(coalesce(name, split_part(split_part(new.email, '@', 1), '+', 1))),
      left(name, 50),
      case when avatar ~ '^https://' and char_length(avatar) <= 500 then avatar end,
      case when signup_locale ~ '^[a-z]{2}$' then signup_locale else 'en' end,
      case when public.is_time_zone(signup_tz) then signup_tz else 'UTC' end
    )
    on conflict (username) do nothing;  -- lost a race for the name: pick another
    if found then
      return new;
    end if;
  end loop;
  raise exception 'could not choose a username for %', new.id;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers are internal: no RPC access (suggest_username would reveal which usernames exist).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.suggest_username(text) from public, anon, authenticated;
