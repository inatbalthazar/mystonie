-- Stage 4, a lively album, honestly (ADR 0098). The owner (2026-10-06) wanted the app to feel busy and people to feel
-- noticed. Never with fake people: everything here is either a labelled official account or a real count.
--   1. Official accounts: `profiles.official` ('mascot' for Stonie, 'team' for the team's own accounts), shown as a
--      label wherever their name shows.
--   2. Stonie, the mascot, as an account of its own (it can't sign in) that stamps a member's first finish, their
--      first of each kind and their 10th, 25th, 50th, 100th… (`mascot_milestones`).
--   3. New members follow Stonie and the team's accounts (unfollow any time), so their feed isn't empty on day one.
--   4. Visits: how many people opened your page, your shared cards and your articles (`view_counts`), one a day per
--      visitor, never who. Only the owner reads them.
--   5. Invites: a link that makes the inviter and the new member follow each other (`invites`), and the Plus One
--      sticker for the inviter.

-- ---------------------------------------------------------------------------
-- 1. Official accounts. Not in the column grants: only this migration (Stonie) and the team's route (service role,
-- `ADMIN_EMAILS`) set it.
-- ---------------------------------------------------------------------------
alter table public.profiles add column official text check (official in ('mascot', 'team'));

create index profiles_official on public.profiles (official) where official is not null;

-- Public official accounts, for the labels (a handful: Stonie and the team).
create function public.official_accounts()
returns table (id uuid, username text, official text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.official
  from public.profiles p
  where p.official is not null and p.visibility = 'public'
  order by p.official, p.username
  limit 50;
$$;

revoke execute on function public.official_accounts() from public;
grant execute on function public.official_accounts() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Stonie. An auth user so its profile can follow, be followed and stamp like anyone, but with no password and
-- banned, so nobody can sign in as it. The id is fixed (src/core/official.ts, MASCOT_ID). Its name is reserved for
-- everyone else (is_reserved_username), so the name checks are off for this one update.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, banned_until
)
values (
  '00000000-0000-0000-0000-000000000000', '5707e000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'stonie@mystonie.com', '', now(), '{"provider":"email","providers":["email"]}', '{"name":"Stonie"}',
  now(), now(), '', '', '', '', '2999-12-31'
)
on conflict (id) do nothing;

alter table public.profiles disable trigger user;
update public.profiles
set username = 'stonie',
    display_name = 'Stonie',
    official = 'mascot',
    avatar_url = 'https://mystonie.com/icon.svg',
    bio = 'Mystonie''s mascot, not a person. I stamp your first finishes and your milestones. Block me any time.'
where id = '5707e000-0000-4000-8000-000000000001';
alter table public.profiles enable trigger user;

-- What Stonie already cheered, one row per member and milestone ('finishes:10', 'first:book'), so a milestone is
-- stamped once even when the finish is removed and added again. Written by the trigger below only.
create table public.mascot_milestones (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  milestone  text not null check (milestone ~ '^(finishes:[0-9]{1,5}|first:[a-z]{1,20})$'),
  entry_id   uuid references public.entries (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint mascot_milestones_once unique (user_id, milestone)
);

create index mascot_milestones_entry_id on public.mascot_milestones (entry_id) where entry_id is not null;

alter table public.mascot_milestones enable row level security;
create policy "members read their milestones" on public.mascot_milestones for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.mascot_milestones from anon;
revoke insert, update, delete on public.mascot_milestones from authenticated;

-- The milestones members already passed before Stonie arrived count as cheered, quietly (no stamps on old finishes).
insert into public.mascot_milestones (id, user_id, milestone)
select private.uuid_v7(), u.user_id, 'finishes:' || n
from (
  select user_id, count(*) as finished from public.entries
  where status = 'finished' and deleted_at is null
  group by user_id
) u
cross join unnest(array[1, 10, 25, 50, 100, 250, 500, 1000]) as n
where n <= u.finished
on conflict (user_id, milestone) do nothing;

insert into public.mascot_milestones (id, user_id, milestone)
select private.uuid_v7(), k.user_id, 'first:' || k.kind
from (
  select distinct e.user_id, t.kind from public.entries e join public.titles t on t.id = e.title_id
  where e.status = 'finished' and e.deleted_at is null
) k
on conflict (user_id, milestone) do nothing;

-- A new finish (or one brought back): when it reaches a milestone not cheered yet, Stonie stamps it. The count stops at
-- the next milestone, so a big import costs one bounded count for its first row and a key lookup for the rest.
create function private.stonie_cheers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mascot constant uuid := '5707e000-0000-4000-8000-000000000001';
  counts constant integer[] := array[1, 10, 25, 50, 100, 250, 500, 1000];
  title_kind text;
  next_count integer;
  reached integer;
  marks text[] := '{}';
  added integer;
begin
  if new.status <> 'finished' or new.deleted_at is not null or new.user_id = mascot then
    return null;
  end if;
  if tg_op = 'UPDATE' and old.status = 'finished' and old.deleted_at is null then
    return null;
  end if;
  if not exists (select 1 from public.profiles where id = mascot) or private.is_blocked_between(new.user_id, mascot) then
    return null;
  end if;

  select t.kind into title_kind from public.titles t where t.id = new.title_id;
  if title_kind is not null and not exists (
    select 1 from public.mascot_milestones where user_id = new.user_id and milestone = 'first:' || title_kind
  ) then
    marks := marks || ('first:' || title_kind);
  end if;

  select min(n) into next_count from unnest(counts) as n
  where not exists (select 1 from public.mascot_milestones m where m.user_id = new.user_id and m.milestone = 'finishes:' || n);
  if next_count is not null then
    select count(*) into reached from (
      select 1 from public.entries e
      where e.user_id = new.user_id and e.status = 'finished' and e.deleted_at is null
      limit 1000
    ) x;
    marks := marks || array(
      select 'finishes:' || n from unnest(counts) as n
      where n <= reached
        and not exists (select 1 from public.mascot_milestones m where m.user_id = new.user_id and m.milestone = 'finishes:' || n)
    );
  end if;
  if cardinality(marks) = 0 then
    return null;
  end if;

  insert into public.mascot_milestones (id, user_id, milestone, entry_id)
  select private.uuid_v7(), new.user_id, m, new.id from unnest(marks) as m
  on conflict (user_id, milestone) do nothing;
  get diagnostics added = row_count;
  if added > 0 then
    insert into public.stamps (id, user_id, entry_id, owner_id)
    values (private.uuid_v7(), mascot, new.id, new.user_id)
    on conflict (user_id, entry_id) where deleted_at is null do nothing;
  end if;
  return null;
end;
$$;

revoke execute on function private.stonie_cheers() from public, anon, authenticated;

create trigger entries_stonie_cheers
  after insert or update of status, deleted_at on public.entries
  for each row execute function private.stonie_cheers();

-- ---------------------------------------------------------------------------
-- 3. A new member follows the official accounts (Stonie first). They can unfollow like anyone.
-- ---------------------------------------------------------------------------
create function private.welcome_new_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.follows (id, follower_id, followee_id)
  select private.uuid_v7(), new.id, p.id
  from public.profiles p
  where p.official is not null and p.visibility = 'public' and p.id <> new.id
  order by p.official = 'mascot' desc, p.created_at
  limit 20
  on conflict (follower_id, followee_id) where deleted_at is null do nothing;
  return null;
end;
$$;

revoke execute on function private.welcome_new_member() from public, anon, authenticated;

create trigger profiles_welcome
  after insert on public.profiles
  for each row execute function private.welcome_new_member();

-- ---------------------------------------------------------------------------
-- 4. Visits. A visitor is a salted hash made by the server (the signed-in viewer's id, or the IP address and browser),
-- changing every day; it's kept at most two days, only to count each visitor once a day. Pages count after they're
-- shown in a browser (POST /api/views), so link previews and prefetches don't. The owner's own visits never count.
-- ---------------------------------------------------------------------------
create table public.view_counts (
  subject    text not null check (subject in ('profile', 'card', 'post')),
  subject_id uuid not null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  views      integer not null default 0 check (views >= 0),
  primary key (subject, subject_id, day)
);

create index view_counts_owner_day on public.view_counts (owner_id, day desc);

create table public.view_marks (
  subject    text not null,
  subject_id uuid not null,
  day        date not null,
  visitor    text not null check (char_length(visitor) between 16 and 64),
  primary key (subject, subject_id, day, visitor)
);

alter table public.view_counts enable row level security;
alter table public.view_marks enable row level security;
create policy "owners read their visits" on public.view_counts for select to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.view_counts, public.view_marks from anon;
revoke insert, update, delete on public.view_counts from authenticated;
revoke all on public.view_marks from authenticated;

-- Counts one visit to a public page, shared card or published article; false when it didn't count (not found, the
-- owner, blocked, or this visitor already counted today). Service role only: the route makes the visitor hash.
create function public.record_view(p_subject text, p_subject_id uuid, p_visitor text, p_viewer uuid default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
  today date := (now() at time zone 'utc')::date;
begin
  if p_subject = 'profile' then
    select p.id into owner from public.profiles p where p.id = p_subject_id and p.visibility = 'public';
  elsif p_subject = 'card' then
    select c.user_id into owner from public.cards c
    where c.id = p_subject_id and c.shared_at is not null and c.deleted_at is null and private.is_public_profile(c.user_id);
  elsif p_subject = 'post' then
    select j.user_id into owner from public.journal_posts j
    where j.id = p_subject_id and j.published_at is not null and j.hidden_at is null and j.deleted_at is null;
  end if;
  if owner is null or owner = p_viewer or (p_viewer is not null and private.is_blocked_between(owner, p_viewer)) then
    return false;
  end if;

  insert into public.view_marks (subject, subject_id, day, visitor)
  values (p_subject, p_subject_id, today, p_visitor)
  on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.view_counts (subject, subject_id, owner_id, day, views)
  values (p_subject, p_subject_id, owner, today, 1)
  on conflict (subject, subject_id, day) do update set views = public.view_counts.views + 1;
  -- Now and then, forget the visitors of earlier days.
  if random() < 0.02 then
    delete from public.view_marks where day < today - 1;
  end if;
  return true;
end;
$$;

revoke execute on function public.record_view(text, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.record_view(text, uuid, text, uuid) to service_role;

-- The caller's visits per page, card and article: the last `p_days` days (today included, UTC) and all time.
create function public.my_views(p_days integer default 7)
returns table (subject text, subject_id uuid, recent integer, total integer)
language sql
stable
set search_path = ''
as $$
  select v.subject, v.subject_id,
    coalesce(sum(v.views) filter (where v.day > (now() at time zone 'utc')::date - least(greatest(coalesce(p_days, 7), 1), 366)), 0)::int,
    sum(v.views)::int
  from public.view_counts v
  where v.owner_id = (select auth.uid())
  group by v.subject, v.subject_id;
$$;

revoke execute on function public.my_views(integer) from public, anon;
grant execute on function public.my_views(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Invites. `/join/<username>` remembers the inviter on the device; a new account (two days old at most) accepts it
-- once, and the two follow each other.
-- ---------------------------------------------------------------------------
create table public.invites (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint invites_not_self check (inviter_id <> invitee_id)
);

create index invites_inviter_id on public.invites (inviter_id, created_at desc);

alter table public.invites enable row level security;
create policy "people read their invites" on public.invites for select to authenticated
  using (inviter_id = (select auth.uid()) or invitee_id = (select auth.uid()));
revoke all on public.invites from anon;
revoke insert, update, delete on public.invites from authenticated;

-- Accepts the invite of `p_username` for the caller: nothing (no row) when the caller's account isn't new, already
-- accepted one, or the inviter can't be found, is the caller, is an official account, or one blocked the other.
create function public.accept_invite(p_username text)
returns table (id uuid, username text, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine public.profiles;
  inviter public.profiles;
begin
  if me is null then
    return;
  end if;
  select * into mine from public.profiles p where p.id = me;
  if mine.id is null or mine.created_at < now() - interval '2 days' then
    return;
  end if;
  select * into inviter from public.profiles p
  where p.username = lower(trim(p_username)) and p.visibility = 'public' and p.official is null;
  if inviter.id is null or inviter.id = me or private.is_blocked_between(inviter.id, me) then
    return;
  end if;

  insert into public.invites (id, inviter_id, invitee_id) values (private.uuid_v7(), inviter.id, me)
  on conflict (invitee_id) do nothing;
  if not found then
    return;
  end if;
  insert into public.follows (id, follower_id, followee_id) values (private.uuid_v7(), me, inviter.id)
  on conflict (follower_id, followee_id) where deleted_at is null do nothing;
  -- Only public profiles are followed (S3 social).
  if mine.visibility = 'public' then
    insert into public.follows (id, follower_id, followee_id) values (private.uuid_v7(), inviter.id, me)
    on conflict (follower_id, followee_id) where deleted_at is null do nothing;
  end if;
  return query select inviter.id, inviter.username, inviter.display_name;
end;
$$;

revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- Activity gains "joined from your invite"; that person's follow, part of the invite, isn't listed again.
create or replace function public.my_activity(p_limit integer default 20)
returns table (
  kind text, at timestamptz, user_id uuid, username text, display_name text, avatar_url text, i_follow boolean,
  entry_id uuid, title_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  items as (
    select 'stamp' as kind, s.created_at as at, s.user_id as actor, s.entry_id, t.name as title_name
    from public.stamps s
    join public.entries e on e.id = s.entry_id and e.deleted_at is null
    join public.titles t on t.id = e.title_id, me
    where s.owner_id = me.id and s.deleted_at is null
    union all
    select 'follow', f.created_at, f.follower_id, null, null
    from public.follows f, me
    where f.followee_id = me.id and f.deleted_at is null
      and not exists (select 1 from public.invites i where i.inviter_id = me.id and i.invitee_id = f.follower_id)
    union all
    select 'invite', i.created_at, i.invitee_id, null, null
    from public.invites i, me
    where i.inviter_id = me.id
  )
  select i.kind, i.at, p.id, p.username,
    case when p.visibility = 'public' then p.display_name end,
    case when p.visibility = 'public' then p.avatar_url end,
    exists (select 1 from public.follows f where f.follower_id = me.id and f.followee_id = p.id and f.deleted_at is null),
    i.entry_id, i.title_name
  from items i
  join public.profiles p on p.id = i.actor
  cross join me
  where me.id is not null and not private.is_blocked_between(p.id, me.id)
  order by i.at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- The team's welcome desk (/admin/members): the newest public members, with their latest finish, whether the team
-- member stamped it and follows them. Service role only; the page checks ADMIN_EMAILS first.
-- ---------------------------------------------------------------------------
create function public.newest_members(p_viewer uuid, p_limit integer default 40)
returns table (
  id uuid, username text, display_name text, avatar_url text, joined_at timestamptz, finished integer,
  entry_id uuid, title_name text, stamp_count integer, stamped boolean, i_follow boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url, p.created_at,
    (select count(*)::int from public.entries e where e.user_id = p.id and e.status = 'finished' and e.deleted_at is null),
    last.id, last.name,
    (select count(*)::int from public.stamps s where s.entry_id = last.id and s.deleted_at is null),
    exists (select 1 from public.stamps s where s.entry_id = last.id and s.user_id = p_viewer and s.deleted_at is null),
    exists (select 1 from public.follows f where f.follower_id = p_viewer and f.followee_id = p.id and f.deleted_at is null)
  from public.profiles p
  left join lateral (
    select e.id, t.name from public.entries e join public.titles t on t.id = e.title_id
    where e.user_id = p.id and e.status = 'finished' and e.deleted_at is null
    order by e.finished_at desc nulls last, e.id desc
    limit 1
  ) last on true
  where p.visibility = 'public' and p.official is null and p.id <> p_viewer
    and p.created_at > now() - interval '30 days'
    and not private.is_blocked_between(p.id, p_viewer)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke execute on function public.newest_members(uuid, integer) from public, anon, authenticated;
grant execute on function public.newest_members(uuid, integer) to service_role;
