-- Stage 3: our own scene warnings with votes, and the warnings quiz (docs/product/features/S3-warnings-quiz.md,
-- ADR 0043). People who watched or read a title note where something happens ("a dog dies", S2 · E5 · 41:10, a
-- chapter), others who saw it confirm or dispute, and only the database decides when a warning is confirmed. The quiz
-- asks people about titles they finished: the database serves each question, times each answer and resolves a
-- question after ten answers. Nothing here comes from DoesTheDogDie (its terms allow caching only for speed), and the
-- quiz pays out nothing (Gems stay gated, ADR 0036).

-- A UUID v7 (time-ordered) made in the database, for the rows the quiz writes itself (answers, votes).
create function private.uuid_v7()
returns uuid
language sql
volatile
set search_path = ''
as $$
  select encode(
    set_bit(set_bit(
      overlay(uuid_send(gen_random_uuid())
        placing substring(int8send((extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
        from 1 for 6),
      52, 1), 53, 1),
    'hex')::uuid;
$$;

revoke execute on function private.uuid_v7() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- warning_topics: what a scene warning or a quiz question can be about. Each topic is also a DoesTheDogDie topic, so
-- the topics people chose to avoid (user_avoid_topics, DTDD ids) flag our warnings too. Names and questions are
-- translated in the app (src/core/scene-warnings.ts mirrors this list); `active = false` retires a topic without
-- touching its warnings.
-- ---------------------------------------------------------------------------
create table public.warning_topics (
  slug       text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 40),
  dtdd_id    integer not null unique check (dtdd_id > 0 and dtdd_id <= 100000),
  -- The kinds of title it applies to (jump scares and flashing lights are for the screen only).
  kinds      text[] not null check (cardinality(kinds) > 0 and kinds <@ array['movie', 'series', 'book', 'manga']),
  -- Asked about in the quiz.
  quiz       boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.warning_topics enable row level security;

create policy "warning topics are readable by everyone" on public.warning_topics for select to anon, authenticated
  using (true);

revoke all on public.warning_topics from anon, authenticated;
grant select on public.warning_topics to anon, authenticated;

insert into public.warning_topics (slug, dtdd_id, kinds, quiz) values
  ('dog-dies',          153, '{movie,series,book,manga}', true),
  ('cat-dies',          186, '{movie,series,book,manga}', false),
  ('animal-dies',       189, '{movie,series,book,manga}', true),
  ('animal-cruelty',    229, '{movie,series,book,manga}', false),
  ('spiders',           165, '{movie,series,book,manga}', true),
  ('snakes',            214, '{movie,series,book,manga}', false),
  ('jump-scares',       161, '{movie,series}',            true),
  ('flashing-lights',   167, '{movie,series}',            true),
  ('loud-noises',       339, '{movie,series}',            false),
  ('claustrophobia',    202, '{movie,series,book,manga}', false),
  ('blood-gore',        188, '{movie,series,book,manga}', true),
  ('needles',           190, '{movie,series,book,manga}', true),
  ('vomit',             201, '{movie,series,book,manga}', true),
  ('eye-injury',        200, '{movie,series,book,manga}', false),
  ('seizure',           206, '{movie,series,book,manga}', false),
  ('gun-violence',      232, '{movie,series,book,manga}', true),
  ('torture',           203, '{movie,series,book,manga}', false),
  ('drowning',          191, '{movie,series,book,manga}', false),
  ('car-crash',         184, '{movie,series,book,manga}', false),
  ('sexual-assault',    182, '{movie,series,book,manga}', true),
  ('suicide',           187, '{movie,series,book,manga}', true),
  ('self-harm',         199, '{movie,series,book,manga}', true),
  ('child-abuse',       218, '{movie,series,book,manga}', false),
  ('domestic-violence', 219, '{movie,series,book,manga}', false),
  ('sex-scenes',        197, '{movie,series,book,manga}', true),
  ('drug-use',          193, '{movie,series,book,manga}', false);

-- Whether the caller watched or read the title: a live entry they're watching or finished. Adding a warning and voting
-- on one need it (people vouch only for what they saw).
create function private.can_warn(p_title_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entries e
    where e.user_id = (select auth.uid())
      and e.title_id = p_title_id
      and e.deleted_at is null
      and e.status in ('watching', 'finished')
  );
$$;

revoke execute on function private.can_warn(uuid) from public, anon;
grant execute on function private.can_warn(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- scene_warnings: "there's <topic> in this title", optionally where. Added by someone who watched or read it; the
-- votes trigger alone writes the status and counts.
-- ---------------------------------------------------------------------------
create table public.scene_warnings (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  -- Who added it: never shown to anyone else, and cleared (the warning stays) when the account is deleted.
  user_id    uuid default auth.uid() references public.profiles (id) on delete set null,
  title_id   uuid not null references public.titles (id) on delete cascade,
  topic      text not null references public.warning_topics (slug),
  -- Where it happens, all optional: a series' season and episode, a time into the movie or episode (seconds), a
  -- book's chapter or page, a manga's chapter or volume. The insert trigger checks them against the title's kind.
  season     integer check (season >= 0 and season <= 1000),
  episode    integer check (episode >= 1 and episode <= 10000),
  start_sec  integer check (start_sec >= 0 and start_sec < 86400),
  end_sec    integer check (end_sec >= 0 and end_sec < 86400),
  unit       text check (unit in ('page', 'chapter', 'volume')),
  position   integer check (position >= 1 and position <= 100000),
  -- Written by the database alone (private.tally_scene_warning): confirmations include whoever added it.
  status     text not null default 'pending' check (status in ('pending', 'confirmed', 'disputed')),
  confirms   integer not null default 1 check (confirms >= 0),
  disputes   integer not null default 0 check (disputes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint scene_warnings_episode check ((season is null) = (episode is null)),
  constraint scene_warnings_time check (end_sec is null or (start_sec is not null and end_sec >= start_sec)),
  constraint scene_warnings_position check ((unit is null) = (position is null)),
  constraint scene_warnings_screen_or_page check (unit is null or (season is null and start_sec is null))
);

create index scene_warnings_title_id on public.scene_warnings (title_id) where deleted_at is null;
create index scene_warnings_user_id_created_at on public.scene_warnings (user_id, created_at);
-- The same person can't add the very same warning twice while it's live (the same topic at the same spot).
create unique index scene_warnings_one_live on public.scene_warnings (
  user_id, title_id, topic, coalesce(season, -1), coalesce(episode, -1), coalesce(start_sec, -1),
  coalesce(unit, ''), coalesce(position, -1)
) where deleted_at is null;

create trigger scene_warnings_set_updated_at
  before update on public.scene_warnings
  for each row execute function public.set_updated_at();

-- A new warning: the topic must suit the title's kind, and so must where it happens (seasons and times for the screen,
-- chapters and pages for books, chapters and volumes for manga). It starts as pending with its adder's confirmation,
-- whatever was sent, and one person adds at most 30 a day.
create function private.check_scene_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  title_kind text;
  topic_row public.warning_topics;
begin
  select t.kind into title_kind from public.titles t where t.id = new.title_id;
  select * into topic_row from public.warning_topics w where w.slug = new.topic;
  if topic_row.slug is not null and (not topic_row.active or not (title_kind = any (topic_row.kinds))) then
    raise exception 'topic % is not for a %', new.topic, title_kind using errcode = '23514';
  end if;
  if (title_kind = 'movie' and (new.season is not null or new.unit is not null))
     or (title_kind = 'series' and new.unit is not null)
     or (title_kind in ('book', 'manga') and (new.season is not null or new.start_sec is not null))
     or (title_kind = 'book' and new.unit not in ('chapter', 'page'))
     or (title_kind = 'manga' and new.unit not in ('chapter', 'volume')) then
    raise exception 'that place does not fit a %', title_kind using errcode = '23514';
  end if;
  if new.user_id is not null
     and (select count(*) from public.scene_warnings w
          where w.user_id = new.user_id and w.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too many warnings today' using errcode = '23514', hint = 'daily_limit';
  end if;
  new.status := 'pending';
  new.confirms := 1;
  new.disputes := 0;
  return new;
end;
$$;

revoke execute on function private.check_scene_warning() from public, anon, authenticated;

create trigger scene_warnings_check
  before insert on public.scene_warnings
  for each row execute function private.check_scene_warning();

-- ---------------------------------------------------------------------------
-- scene_warning_votes: "I saw it there" (1) or "it isn't there" (-1), one live vote per person and warning.
-- ---------------------------------------------------------------------------
create table public.scene_warning_votes (
  id         uuid primary key check (uuid_extract_version(id) = 7),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  warning_id uuid not null references public.scene_warnings (id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index scene_warning_votes_one_live on public.scene_warning_votes (user_id, warning_id) where deleted_at is null;
create index scene_warning_votes_warning_id on public.scene_warning_votes (warning_id) where deleted_at is null;
create index scene_warning_votes_user_id_updated_at on public.scene_warning_votes (user_id, updated_at);

create trigger scene_warning_votes_set_updated_at
  before update on public.scene_warning_votes
  for each row execute function public.set_updated_at();

-- Whether the caller may vote on a warning: a live one someone else added, to a title they watched or read.
create function private.can_vote(p_warning_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.scene_warnings w
    where w.id = p_warning_id
      and w.deleted_at is null
      and w.user_id is distinct from (select auth.uid())
      and private.can_warn(w.title_id)
  );
$$;

revoke execute on function private.can_vote(uuid) from public, anon;
grant execute on function private.can_vote(uuid) to authenticated;

-- The verification rule (the one place it lives; src/core/scene-warnings.ts shows the same numbers): confirmed at 5
-- confirmations (whoever added it counts) and more confirmations than disputes; disputed at 5 disputes and at least as
-- many as confirmations; pending otherwise.
create function private.scene_warning_status(p_confirms integer, p_disputes integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_confirms >= 5 and p_confirms > p_disputes then 'confirmed'
    when p_disputes >= 5 and p_disputes >= p_confirms then 'disputed'
    else 'pending'
  end;
$$;

revoke execute on function private.scene_warning_status(integer, integer) from public, anon, authenticated;

-- After any vote changes: recount the warning's live votes and set its status. The warning row is locked first, so
-- votes arriving together are counted one after the other.
create function private.tally_scene_warning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.warning_id, old.warning_id);
begin
  perform 1 from public.scene_warnings w where w.id = target for update;
  update public.scene_warnings w
  set confirms = c.confirms, disputes = c.disputes, status = private.scene_warning_status(c.confirms, c.disputes)
  from (
    select 1 + (count(*) filter (where v.vote = 1))::int as confirms, (count(*) filter (where v.vote = -1))::int as disputes
    from public.scene_warning_votes v
    where v.warning_id = target and v.deleted_at is null
  ) c
  where w.id = target
    and (w.confirms, w.disputes) is distinct from (c.confirms, c.disputes);
  return null;
end;
$$;

revoke execute on function private.tally_scene_warning() from public, anon, authenticated;

create trigger scene_warning_votes_tally
  after insert or update of vote, deleted_at or delete on public.scene_warning_votes
  for each row execute function private.tally_scene_warning();

-- ---------------------------------------------------------------------------
-- RLS and column grants. Warnings and votes are read by others only through the functions below, which return what
-- was said and the totals, never who said it.
-- ---------------------------------------------------------------------------
alter table public.scene_warnings enable row level security;
alter table public.scene_warning_votes enable row level security;

create policy "people read the warnings they added" on public.scene_warnings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "viewers add warnings to what they watched or read" on public.scene_warnings for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_warn(title_id));
-- Withdrawing is a soft delete, and only while the warning waits: once confirmed, others rely on it.
create policy "people withdraw a warning while it waits" on public.scene_warnings for update to authenticated
  using (user_id = (select auth.uid()) and status = 'pending')
  with check (user_id = (select auth.uid()));

create policy "people read their votes" on public.scene_warning_votes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "viewers vote on warnings" on public.scene_warning_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_vote(warning_id));
-- Changing a vote needs the same right; taking one back is always allowed.
create policy "people change their votes" on public.scene_warning_votes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (deleted_at is not null or private.can_vote(warning_id)));

revoke all on public.scene_warnings, public.scene_warning_votes from anon;
revoke insert, update, delete, truncate, references, trigger on public.scene_warnings, public.scene_warning_votes from authenticated;
grant select on public.scene_warnings, public.scene_warning_votes to authenticated;
-- status, confirms and disputes are the database's alone.
grant insert (id, user_id, title_id, topic, season, episode, start_sec, end_sec, unit, position) on public.scene_warnings to authenticated;
grant update (deleted_at) on public.scene_warnings to authenticated;
grant insert (id, user_id, warning_id, vote) on public.scene_warning_votes to authenticated;
grant update (vote, deleted_at) on public.scene_warning_votes to authenticated;

-- A title's warnings for its page (signed in): live pending and confirmed ones, and disputed ones only to whoever
-- added them. `mine` and `my_vote` are the caller's own; who else added or voted is never returned.
create function public.title_scene_warnings(p_title_id uuid)
returns table (
  id uuid, topic text, season integer, episode integer, start_sec integer, end_sec integer, unit text,
  "position" integer, status text, confirms integer, disputes integer, created_at timestamptz,
  mine boolean, my_vote smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.topic, w.season, w.episode, w.start_sec, w.end_sec, w.unit, w.position, w.status, w.confirms,
    w.disputes, w.created_at,
    coalesce(w.user_id = (select auth.uid()), false),
    (select v.vote from public.scene_warning_votes v
     where v.warning_id = w.id and v.user_id = (select auth.uid()) and v.deleted_at is null)
  from public.scene_warnings w
  where w.title_id = p_title_id
    and w.deleted_at is null
    and (w.status <> 'disputed' or w.user_id = (select auth.uid()))
  order by w.season nulls first, w.episode nulls first, w.position nulls first, w.start_sec nulls first,
    w.created_at, w.id
  limit 200;
$$;

revoke execute on function public.title_scene_warnings(uuid) from public, anon;
grant execute on function public.title_scene_warnings(uuid) to authenticated;

-- One warning's totals after a vote, and the caller's vote; no row once it's withdrawn. (A disputed one still answers:
-- whoever just tipped it there sees why it leaves their list.)
create function public.scene_warning_tally(p_warning_id uuid)
returns table (status text, confirms integer, disputes integer, my_vote smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select w.status, w.confirms, w.disputes,
    (select v.vote from public.scene_warning_votes v
     where v.warning_id = w.id and v.user_id = (select auth.uid()) and v.deleted_at is null)
  from public.scene_warnings w
  where w.id = p_warning_id
    and w.deleted_at is null;
$$;

revoke execute on function public.scene_warning_tally(uuid) from public, anon;
grant execute on function public.scene_warning_tally(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The warnings quiz. quiz_questions: "is there <topic> in <title>?", asked of people who finished the title until ten
-- of them answered yes or no; then the side with at least 5 and more than the other wins (5–5 is contested).
-- quiz_answers: each question served to someone, with the server's clock on serving and answering. quiz_pauses:
-- someone answering faster than anyone can read waits an hour. Only the functions below write them.
-- ---------------------------------------------------------------------------
create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  title_id    uuid not null references public.titles (id) on delete cascade,
  topic       text not null references public.warning_topics (slug),
  -- Counted answers only (not "don't remember", not too fast, not after it resolved).
  yes_count   integer not null default 0 check (yes_count >= 0),
  no_count    integer not null default 0 check (no_count >= 0),
  status      text not null default 'open' check (status in ('open', 'yes', 'no', 'contested')),
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (title_id, topic),
  constraint quiz_questions_resolved check ((status = 'open') = (resolved_at is null))
);

create index quiz_questions_open on public.quiz_questions (title_id) where status = 'open';

create trigger quiz_questions_set_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

create table public.quiz_answers (
  id          uuid primary key default private.uuid_v7() check (uuid_extract_version(id) = 7),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- A topic question, or a warning waiting for confirmations (the answer then is a vote on it).
  question_id uuid references public.quiz_questions (id) on delete cascade,
  warning_id  uuid references public.scene_warnings (id) on delete cascade,
  choice      text check (choice in ('yes', 'no', 'unsure')),
  served_at   timestamptz not null default now(),
  answered_at timestamptz,
  counted     boolean not null default false,
  too_fast    boolean not null default false,
  constraint quiz_answers_one_target check ((question_id is null) <> (warning_id is null)),
  constraint quiz_answers_answered check ((choice is null) = (answered_at is null))
);

-- Never the same question twice.
create unique index quiz_answers_one_per_question on public.quiz_answers (user_id, question_id) where question_id is not null;
create unique index quiz_answers_one_per_warning on public.quiz_answers (user_id, warning_id) where warning_id is not null;
create index quiz_answers_question_id on public.quiz_answers (question_id);
create index quiz_answers_warning_id on public.quiz_answers (warning_id);
create index quiz_answers_too_fast on public.quiz_answers (user_id, answered_at) where too_fast;

create table public.quiz_pauses (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  paused_until timestamptz not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger quiz_pauses_set_updated_at
  before update on public.quiz_pauses
  for each row execute function public.set_updated_at();

alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.quiz_pauses enable row level security;

-- Questions are totals about titles (no people): readable when signed in. Answers: only your own (the export).
create policy "signed-in people read quiz questions" on public.quiz_questions for select to authenticated
  using (true);
create policy "people read their quiz answers" on public.quiz_answers for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.quiz_questions, public.quiz_answers, public.quiz_pauses from anon, authenticated;
grant select on public.quiz_questions, public.quiz_answers to authenticated;

-- A question with ten counted answers: yes or no with at least 5 and more than the other side, else contested.
create function private.quiz_resolution(p_yes integer, p_no integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_yes >= 5 and p_yes > p_no then 'yes'
    when p_no >= 5 and p_no > p_yes then 'no'
    else 'contested'
  end;
$$;

revoke execute on function private.quiz_resolution(integer, integer) from public, anon, authenticated;

-- The caller's next question, as JSON:
--   {status: "question", id, kind: "warning" | "topic", topic, title: {…}, where: {…} | null, answers}
--   {status: "paused", until} · {status: "no_finishes"} · {status: "done"}
-- Only titles the caller finished. In order: the question served last and not answered yet (a reload shows it again);
-- a warning someone else added and nobody confirmed enough yet, closest to confirmed first; an open question others
-- answered, closest to resolved first; else a new question about a finished title and a quiz topic nobody asked yet
-- (and no confirmed warning answers). `p_title_id` (a title just finished) is tried first. `p_topics` are the topics
-- the app has words for: a topic added here before the app knows how to ask about it is left out.
create function public.quiz_next(p_title_id uuid default null, p_topics text[] default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  paused timestamptz;
  pick uuid;
  target uuid;
  only_title uuid;
  new_title uuid;
  new_topic text;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select p.paused_until into paused from public.quiz_pauses p where p.user_id = me and p.paused_until > now();
  if paused is not null then
    return jsonb_build_object('status', 'paused', 'until', paused);
  end if;
  if not exists (select 1 from public.entries e where e.user_id = me and e.status = 'finished' and e.deleted_at is null) then
    return jsonb_build_object('status', 'no_finishes');
  end if;

  select a.id into pick
  from public.quiz_answers a
  left join public.quiz_questions q on q.id = a.question_id
  left join public.scene_warnings w on w.id = a.warning_id
  where a.user_id = me
    and a.choice is null
    and (q.status = 'open' or (w.deleted_at is null and w.status = 'pending'))
    and (p_title_id is null or coalesce(q.title_id, w.title_id) = p_title_id)
    and (p_topics is null or coalesce(q.topic, w.topic) = any (p_topics))
  order by a.served_at desc
  limit 1;

  if pick is null then
    for attempt in 1..2 loop
      continue when attempt = 1 and p_title_id is null;
      only_title := case when attempt = 1 then p_title_id end;

      select w.id into target
      from public.scene_warnings w
      join public.entries e
        on e.title_id = w.title_id and e.user_id = me and e.status = 'finished' and e.deleted_at is null
      join public.warning_topics t on t.slug = w.topic and t.active and (p_topics is null or t.slug = any (p_topics))
      where w.deleted_at is null
        and w.status = 'pending'
        and w.user_id is distinct from me
        and (only_title is null or w.title_id = only_title)
        and not exists (select 1 from public.scene_warning_votes v
                        where v.warning_id = w.id and v.user_id = me and v.deleted_at is null)
        and not exists (select 1 from public.quiz_answers a where a.warning_id = w.id and a.user_id = me)
      order by w.confirms desc, w.created_at, w.id
      limit 1;
      if target is not null then
        insert into public.quiz_answers (user_id, warning_id) values (me, target) returning id into pick;
        exit;
      end if;

      select q.id into target
      from public.quiz_questions q
      join public.entries e
        on e.title_id = q.title_id and e.user_id = me and e.status = 'finished' and e.deleted_at is null
      join public.warning_topics t
        on t.slug = q.topic and t.active and t.quiz and (p_topics is null or t.slug = any (p_topics))
      where q.status = 'open'
        and (only_title is null or q.title_id = only_title)
        and not exists (select 1 from public.quiz_answers a where a.question_id = q.id and a.user_id = me)
      order by q.yes_count + q.no_count desc, q.created_at, q.id
      limit 1;

      if target is null then
        select e.title_id, t.slug into new_title, new_topic
        from public.entries e
        join public.titles ti on ti.id = e.title_id
        join public.warning_topics t
          on t.active and t.quiz and ti.kind = any (t.kinds) and (p_topics is null or t.slug = any (p_topics))
        where e.user_id = me
          and e.status = 'finished'
          and e.deleted_at is null
          and (only_title is null or e.title_id = only_title)
          and not exists (select 1 from public.quiz_questions q where q.title_id = e.title_id and q.topic = t.slug)
          and not exists (select 1 from public.scene_warnings w
                          where w.title_id = e.title_id and w.topic = t.slug and w.status = 'confirmed'
                            and w.deleted_at is null)
        order by random()
        limit 1;
        if new_title is not null then
          insert into public.quiz_questions (title_id, topic) values (new_title, new_topic)
          on conflict (title_id, topic) do nothing
          returning id into target;
        end if;
      end if;

      if target is not null then
        insert into public.quiz_answers (user_id, question_id) values (me, target)
        on conflict do nothing
        returning id into pick;
        exit when pick is not null;
      end if;
    end loop;
  end if;

  if pick is null then
    return jsonb_build_object('status', 'done');
  end if;
  update public.quiz_answers set served_at = now() where id = pick;

  return (
    select jsonb_build_object(
      'status', 'question',
      'id', a.id,
      'kind', case when a.warning_id is null then 'topic' else 'warning' end,
      'topic', coalesce(q.topic, w.topic),
      'title', jsonb_build_object(
        'id', ti.id, 'kind', ti.kind, 'source', ti.source, 'externalId', ti.external_id, 'name', ti.name,
        'year', ti.year, 'posterPath', ti.poster_path),
      'where', case when w.id is null then null else jsonb_build_object(
        'season', w.season, 'episode', w.episode, 'startSec', w.start_sec, 'endSec', w.end_sec,
        'unit', w.unit, 'position', w.position) end,
      'answers', case when w.id is null then q.yes_count + q.no_count else w.confirms end)
    from public.quiz_answers a
    left join public.quiz_questions q on q.id = a.question_id
    left join public.scene_warnings w on w.id = a.warning_id
    join public.titles ti on ti.id = coalesce(q.title_id, w.title_id)
    where a.id = pick
  );
end;
$$;

revoke execute on function public.quiz_next(uuid, text[]) from public, anon;
grant execute on function public.quiz_next(uuid, text[]) to authenticated;

-- Answers a served question ("yes", "no" or "unsure", i.e. don't remember), as JSON:
--   {status: "counted" | "not_counted", kind, result, yes, no, confirms, disputes}
--   {status: "too_fast"} · {status: "paused", until} · {status: "answered"} · {status: "gone"}
-- The server's clock decides: an answer under 1.5 s after serving counts for nothing, and the third one within ten
-- minutes pauses the quiz for an hour. A counted answer to a warning is the caller's vote on it; the tenth counted
-- answer to a topic question resolves it. An answer after the question resolved is kept but not counted.
create function public.quiz_answer(p_id uuid, p_choice text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  paused timestamptz;
  answer_row public.quiz_answers;
  question_row public.quiz_questions;
  warning_row public.scene_warnings;
  fast boolean;
  counts boolean;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if p_choice is null or p_choice not in ('yes', 'no', 'unsure') then
    raise exception 'choice must be yes, no or unsure' using errcode = '22023';
  end if;
  select p.paused_until into paused from public.quiz_pauses p where p.user_id = me and p.paused_until > now();
  if paused is not null then
    return jsonb_build_object('status', 'paused', 'until', paused);
  end if;

  select * into answer_row from public.quiz_answers a where a.id = p_id and a.user_id = me for update;
  if answer_row.id is null then
    return jsonb_build_object('status', 'gone');
  end if;
  if answer_row.choice is not null then
    return jsonb_build_object('status', 'answered');
  end if;

  fast := now() - answer_row.served_at < interval '1.5 seconds';
  counts := not fast and p_choice <> 'unsure';
  if answer_row.question_id is not null then
    select * into question_row from public.quiz_questions q where q.id = answer_row.question_id for update;
    counts := counts and question_row.status = 'open';
  else
    select * into warning_row from public.scene_warnings w where w.id = answer_row.warning_id;
    counts := counts and warning_row.deleted_at is null;
  end if;

  update public.quiz_answers a
  set choice = p_choice, answered_at = now(), counted = counts, too_fast = fast
  where a.id = answer_row.id;

  if fast then
    if (select count(*) from public.quiz_answers a
        where a.user_id = me and a.too_fast and a.answered_at > now() - interval '10 minutes') >= 3 then
      insert into public.quiz_pauses (user_id, paused_until) values (me, now() + interval '1 hour')
      on conflict (user_id) do update set paused_until = excluded.paused_until;
      return jsonb_build_object('status', 'paused', 'until', now() + interval '1 hour');
    end if;
    return jsonb_build_object('status', 'too_fast');
  end if;

  if counts and question_row.id is not null then
    update public.quiz_questions q
    set yes_count = q.yes_count + (p_choice = 'yes')::int, no_count = q.no_count + (p_choice = 'no')::int
    where q.id = question_row.id
    returning * into question_row;
    if question_row.yes_count + question_row.no_count >= 10 then
      update public.quiz_questions q
      set status = private.quiz_resolution(question_row.yes_count, question_row.no_count), resolved_at = now()
      where q.id = question_row.id
      returning * into question_row;
    end if;
  elsif counts then
    -- A vote made here counts like one from the title page (someone who already voted keeps their vote).
    insert into public.scene_warning_votes (id, user_id, warning_id, vote)
    values (private.uuid_v7(), me, warning_row.id, case when p_choice = 'yes' then 1 else -1 end)
    on conflict do nothing;
    select * into warning_row from public.scene_warnings w where w.id = answer_row.warning_id;
  end if;

  return jsonb_build_object(
    'status', case when counts then 'counted' else 'not_counted' end,
    'kind', case when answer_row.warning_id is null then 'topic' else 'warning' end,
    'result', coalesce(question_row.status, warning_row.status),
    'yes', question_row.yes_count,
    'no', question_row.no_count,
    'confirms', warning_row.confirms,
    'disputes', warning_row.disputes);
end;
$$;

revoke execute on function public.quiz_answer(uuid, text) from public, anon;
grant execute on function public.quiz_answer(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Badges from our own data: the caller's avoid-topics (DTDD ids) that a confirmed warning or a quiz "yes" puts in
-- these titles. With `avoid_warnings` (DTDD's votes), the collection and search flag titles from both sources.
-- ---------------------------------------------------------------------------
create function public.community_avoid_hits(p_title_ids uuid[])
returns table (title_id uuid, topic_id integer, topic text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct h.title_id, t.dtdd_id, t.slug
  from (
    select w.title_id, w.topic from public.scene_warnings w
    where w.title_id = any (p_title_ids) and w.status = 'confirmed' and w.deleted_at is null
    union
    select q.title_id, q.topic from public.quiz_questions q
    where q.title_id = any (p_title_ids) and q.status = 'yes'
  ) h
  join public.warning_topics t on t.slug = h.topic
  join public.user_avoid_topics a
    on a.topic_id = t.dtdd_id and a.user_id = (select auth.uid()) and a.deleted_at is null;
$$;

revoke execute on function public.community_avoid_hits(uuid[]) from public, anon;
grant execute on function public.community_avoid_hits(uuid[]) to authenticated;
