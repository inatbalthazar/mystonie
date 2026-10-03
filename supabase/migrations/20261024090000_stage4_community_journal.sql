-- Stage 4, the Journal by its members (ADR 0092): anyone can write an article, keep it as a draft, publish it on their
-- page and send it to be Featured; the team approves it from the admin page (service role), and a Featured article
-- is in everyone's Journal. Stamps and Saves reuse journal_marks: a member's article is named by its id, which fits
-- the slug check there. User rows under the day-one rules (UUID v7, server-stamped updated_at, soft delete).

-- What an article is about: `movie:603`, `book:zyTCAlFPjgYC`, `place:JP` (the same checks as src/core/journal-posts.ts).
create function private.valid_journal_subjects(p_subjects text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
    s ~ '^(movie|series|manga|game):[0-9]{1,10}$'
    or s ~ '^book:[A-Za-z0-9_-]{12}$'
    or s ~ '^place:[A-Z]{2}$'
  ), true)
  from unnest(p_subjects) s;
$$;

revoke execute on function private.valid_journal_subjects(text[]) from public;
grant execute on function private.valid_journal_subjects(text[]) to anon, authenticated, service_role;

create table public.journal_posts (
  id              uuid primary key check (uuid_extract_version(id) = 7),
  user_id         uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- The language it's written in (the app's locales).
  locale          text not null check (locale in ('en', 'th')),
  title           text not null check (char_length(title) between 1 and 120),
  description     text check (char_length(description) between 1 and 200),
  -- The Markdown subset without links, images or title cards (parseWriterBody).
  body            text not null default '' check (char_length(body) <= 20000),
  -- Worked out from the body when it's saved (POST /api/journal/posts), for the Journal's rows: no row reads every body.
  excerpt         text check (char_length(excerpt) between 1 and 200),
  minutes         smallint not null default 1 check (minutes between 1 and 200),
  tags            text[] not null default '{}' check (
    cardinality(tags) <= 3
    and tags <@ array['review', 'list', 'opinion', 'guide', 'travel', 'on_this_day', 'behind_the_scenes']
  ),
  subjects        text[] not null default '{}' check (cardinality(subjects) <= 6 and private.valid_journal_subjects(subjects)),
  spoilers        boolean not null default false,
  -- Null while it's a draft; stamped by the database the first time it's published.
  published_at    timestamptz,
  -- Sent to be Featured (pending), then the team's answer; the writer can only send it or take it back.
  feature_request text check (feature_request in ('pending', 'approved', 'declined')),
  featured_at     timestamptz,
  -- The team's note to the writer with its answer.
  review_note     text check (char_length(review_note) between 1 and 300),
  -- Taken down by the team: out of sight for everyone but its writer.
  hidden_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  check ((feature_request = 'approved') = (featured_at is not null))
);

comment on table public.journal_posts is
  'Journal articles by members (ADR 0092). Drafts are the writer''s; published ones are public while the writer''s page is; Featured ones (approved by the team) are in everyone''s Journal.';

create index journal_posts_user_id_updated_at on public.journal_posts (user_id, updated_at);
create index journal_posts_published on public.journal_posts (user_id, published_at desc)
  where published_at is not null and hidden_at is null and deleted_at is null;
create index journal_posts_featured on public.journal_posts (featured_at desc)
  where feature_request = 'approved' and hidden_at is null and deleted_at is null;
create index journal_posts_pending on public.journal_posts (updated_at)
  where feature_request = 'pending' and published_at is not null and deleted_at is null;
create index journal_posts_subjects on public.journal_posts using gin (subjects)
  where published_at is not null and hidden_at is null and deleted_at is null;

create trigger journal_posts_set_updated_at
  before update on public.journal_posts
  for each row execute function public.set_updated_at();

-- The writer's side of the rules (the service role, the admin page, skips them):
-- * published_at is the database's clock, set once; unpublishing takes the article out of Featured;
-- * the writer may only send it to be Featured or take that back, never approve or decline it;
-- * changing the text of a Featured (or declined) article sends it back to the team as pending;
-- * at most 10 new articles a day and 500 live ones per writer.
create function private.check_journal_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  edited boolean;
begin
  if (select auth.role()) = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from public.journal_posts
        where user_id = new.user_id and created_at > now() - interval '1 day') >= 10
       or (select count(*) from public.journal_posts where user_id = new.user_id and deleted_at is null) >= 500 then
      raise exception 'too many journal posts' using errcode = '23514';
    end if;
    new.published_at := case when new.published_at is not null then now() end;
    if new.feature_request is not null and new.feature_request <> 'pending' then
      raise exception 'only the team answers feature requests' using errcode = '42501';
    end if;
    new.featured_at := null;
    new.review_note := null;
    new.hidden_at := null;
    return new;
  end if;

  -- Update.
  if new.published_at is null then
    new.feature_request := null;
  elsif old.published_at is null then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;

  edited := new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.body is distinct from old.body
    or new.subjects is distinct from old.subjects
    or new.tags is distinct from old.tags
    or new.spoilers is distinct from old.spoilers;

  if new.feature_request is distinct from old.feature_request then
    -- Sending it (again) or taking the request back is the writer's; answers are the team's.
    if new.feature_request is not null and new.feature_request <> 'pending' then
      raise exception 'only the team answers feature requests' using errcode = '42501';
    end if;
    new.review_note := null;
  elsif old.feature_request in ('approved', 'declined') and edited and new.published_at is not null then
    new.feature_request := 'pending';
    new.review_note := null;
  end if;
  if new.feature_request is distinct from 'approved' then
    new.featured_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.check_journal_post() from public, anon, authenticated;

create trigger journal_posts_check
  before insert or update on public.journal_posts
  for each row execute function private.check_journal_post();

alter table public.journal_posts enable row level security;

-- Their deleted ones too (a soft delete must still pass this check); the app filters deleted_at itself.
create policy "writers read their journal posts" on public.journal_posts for select to authenticated
  using (user_id = (select auth.uid()));
-- Published, not taken down, and the writer's page is public and not blocked either way (is_public_profile).
create policy "everyone reads published journal posts" on public.journal_posts for select to anon, authenticated
  using (published_at is not null and hidden_at is null and deleted_at is null and private.is_public_profile(user_id));
create policy "members write journal posts" on public.journal_posts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "writers update their journal posts" on public.journal_posts for update to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null) with check (user_id = (select auth.uid()));

revoke all on public.journal_posts from anon, authenticated;
grant select on public.journal_posts to anon, authenticated;
grant insert (id, user_id, locale, title, description, body, excerpt, minutes, tags, subjects, spoilers, published_at, feature_request)
  on public.journal_posts to authenticated;
grant update (locale, title, description, body, excerpt, minutes, tags, subjects, spoilers, published_at, feature_request, deleted_at)
  on public.journal_posts to authenticated;

-- The bylines of articles' writers (profiles are their owner's only): name, username and photo of public,
-- unblocked people, for the Journal's rows and pages.
create function public.journal_bylines(p_user_ids uuid[])
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles p
  where p.id = any (p_user_ids[1:200]) and private.is_public_profile(p.id);
$$;

revoke execute on function public.journal_bylines(uuid[]) from public;
grant execute on function public.journal_bylines(uuid[]) to anon, authenticated;

-- "Report" on a member's article.
alter table public.reports drop constraint reports_target_kind_check;
alter table public.reports add constraint reports_target_kind_check check (target_kind in ('profile', 'card', 'article'));
