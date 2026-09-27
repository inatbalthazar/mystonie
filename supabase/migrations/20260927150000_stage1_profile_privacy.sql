-- Stage 1 profile & privacy (S1 profile, ADR 0027): the name blocklist, the public profile read, shared-card
-- reads that respect private profiles, and reports.

-- ---------------------------------------------------------------------------
-- Name blocklist. Usernames and display names are checked here, because clients may update their profile
-- directly (RLS + column grants), so the app can't be the only gate.
-- ---------------------------------------------------------------------------

-- True for names that impersonate the service or are clearly abusive. The name is folded first
-- (lower-case, common digit/symbol swaps undone, only a–z and 0–9 kept), so "M-y_St0nie" is "mystonie".
-- Substring rules only use words that don't hide inside common names ("porn" would block "Pornchai",
-- "shit" would block "Yoshitaka"); those are matched as the whole name instead. Reports are the backstop.
create or replace function private.is_blocked_name(name text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  folded text := regexp_replace(translate(lower(coalesce(name, '')), '013457@$!|', 'oieastasii'), '[^a-z0-9]', '', 'g');
begin
  if folded = '' then
    return false;
  end if;
  return folded = any (array[
      -- the service and its people
      'admin', 'administrator', 'moderator', 'mod', 'mods', 'official', 'staff', 'support', 'team', 'help',
      'helpdesk', 'security', 'abuse', 'system', 'root', 'owner', 'mysto', 'mystonie', 'stonie', 'everyone',
      -- abusive as a whole name
      'shit', 'nazi', 'sex', 'cock', 'dick', 'pussy', 'ass', 'asshole', 'slut', 'rape', 'porn'
    ])
    or folded ~ '(mystonie|stonie|mysto(official|team|support|admin|staff|app|hq)|(official|team|support|admin|staff)mysto)'
    or folded ~ '(fuck|cunt|nigger|nigga|faggot|retard|whore|bitch|hitler|kkk|pedophile|paedophile)';
end;
$$;

revoke execute on function private.is_blocked_name(text) from public, anon, authenticated;

-- Usernames also can't take route or role names. suggest_username() calls this, so generated names
-- (a base plus 4 random digits) never trip the blocklist either.
create or replace function public.is_reserved_username(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select name = any (array[
    'admin', 'administrator', 'api', 'auth', 'help', 'mystonie', 'stonie', 'root', 'settings', 'support',
    'system', 'privacy', 'terms', 'unsubscribe', 'null', 'undefined', 'www', 'mail', 'official', 'staff',
    'about', 'account', 'app', 'billing', 'blog', 'card', 'cards', 'collection', 'contact', 'download', 'edit',
    'explore', 'home', 'legal', 'login', 'logout', 'new', 'premium', 'press', 'pro', 'recap', 'recaps',
    'register', 'report', 'reports', 'search', 'signin', 'signup', 'stats', 'status', 'title', 'titles', 'trending'
  ]) or private.is_blocked_name(name);
$$;

-- Same as before, but names without Latin letters now fall back to "collector" + digits: "stonie" + digits
-- would look official, and the blocklist rejects it.
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
    base := 'collector';
  end if;
  candidate := base;
  for attempt in 1..20 loop
    if not public.is_reserved_username(candidate)
       and not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    candidate := base || (1000 + floor(random() * 9000))::int::text;
  end loop;
  return 'collector' || substr(md5(random()::text), 1, 8);
end;
$$;

revoke execute on function public.suggest_username(text) from public, anon, authenticated;

-- Runs as the table owner, so the helpers above stay private. On sign-up a blocked Google name is dropped
-- (the account still gets made); later changes are rejected with SQLSTATE 23514 and the column as the hint,
-- which PATCH /api/account turns into a message.
create or replace function private.check_profile_names()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username) and public.is_reserved_username(new.username) then
    raise exception 'username not allowed' using errcode = '23514', hint = 'username';
  end if;
  if (tg_op = 'INSERT' or new.display_name is distinct from old.display_name) and private.is_blocked_name(new.display_name) then
    if tg_op = 'INSERT' then
      new.display_name := null;
    else
      raise exception 'display name not allowed' using errcode = '23514', hint = 'display_name';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.check_profile_names() from public, anon, authenticated;

create trigger profiles_check_names
  before insert or update of username, display_name on public.profiles
  for each row execute function private.check_profile_names();

-- ---------------------------------------------------------------------------
-- Public profile read (/u/[username]). Profiles are owner-only (time zone and locale are personal), so the
-- page reads this safe subset. A private profile only says that it exists and is private.
-- ---------------------------------------------------------------------------
create or replace function public.public_profile(p_username text)
returns table (id uuid, username text, display_name text, avatar_url text, is_private boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when p.visibility = 'public' then p.id end,
    p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end,
    p.visibility = 'private',
    case when p.visibility = 'public' then p.created_at end
  from public.profiles p
  where p.username = lower(p_username);
$$;

revoke execute on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Shared cards. Before: anyone could read (and so list) every shared card, private profiles included.
-- Now listing needs a public profile (the gallery), and a card link works through shared_card(id), which
-- needs the id: sharing is an explicit publish of that one card (S1 profile → Privacy).
-- ---------------------------------------------------------------------------
drop policy "shared cards are readable" on public.cards;
create policy "shared cards of public profiles are readable" on public.cards for select to anon, authenticated
  using (shared_at is not null and deleted_at is null and private.is_public_profile(user_id));

create index cards_user_id_shared_at on public.cards (user_id, shared_at desc)
  where shared_at is not null and deleted_at is null;

-- One live shared card by id, plus the owner's current username when their profile is public and the card
-- shows their name (for the "from @name's collection" link).
create or replace function public.shared_card(p_id uuid)
returns table (
  id uuid, kind text, template_id text, size text, params jsonb, image_path text, shared_at timestamptz,
  profile_username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.kind, c.template_id, c.size, c.params, c.image_path, c.shared_at,
    case when p.visibility = 'public' and c.params ->> 'username' is not null then p.username end
  from public.cards c
  join public.profiles p on p.id = c.user_id
  where c.id = p_id and c.shared_at is not null and c.deleted_at is null;
$$;

revoke execute on function public.shared_card(uuid) from public;
grant execute on function public.shared_card(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- reports: "Report" on public profiles and shared cards. Written by POST /api/reports (service role,
-- rate-limited), read by the owner with an admin query. No client access at all.
-- ---------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key check (uuid_extract_version(id) = 7),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_kind text not null check (target_kind in ('profile', 'card')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'impersonation', 'other')),
  note        text check (char_length(note) between 1 and 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create index reports_open on public.reports (created_at) where resolved_at is null;
create index reports_reporter_id on public.reports (reporter_id);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
