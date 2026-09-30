-- pgTAP tests for scene warnings and the warnings quiz (S3 warnings & quiz, ADR 0043). Run with `pnpm db:test`.
begin;
select plan(62);

-- a1 adds warnings (watching the series, a movie, a book and a manga), a2–a6 finished the series, a7 has nothing.
-- b01–b11 finished both movies and answer the quiz.
insert into auth.users (id, email)
select ('00000000-0000-7000-8000-0000000000a' || n)::uuid, 'sw-a' || n || '@example.com' from generate_series(1, 7) n;
insert into auth.users (id, email)
select ('00000000-0000-7000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, 'sw-b' || n || '@example.com'
from generate_series(1, 11) n;

insert into public.titles (id, kind, source, external_id, name) values
  ('20000000-0000-4000-8000-0000000000a1', 'series', 'tmdb', 'pgtap-sw-series', 'A Series'),
  ('20000000-0000-4000-8000-0000000000a2', 'movie', 'tmdb', 'pgtap-sw-movie', 'A Movie'),
  ('20000000-0000-4000-8000-0000000000a3', 'book', 'google_books', 'pgtapswbook1', 'A Book'),
  ('20000000-0000-4000-8000-0000000000a4', 'manga', 'anilist', '990000001', 'A Manga'),
  ('20000000-0000-4000-8000-0000000000a5', 'movie', 'tmdb', 'pgtap-sw-tie', 'A Tied Movie');

insert into public.entries (id, user_id, title_id, status)
select private.uuid_v7(), '00000000-0000-7000-8000-0000000000a1', t, 'watching'
from unnest(array['20000000-0000-4000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a2',
                  '20000000-0000-4000-8000-0000000000a3', '20000000-0000-4000-8000-0000000000a4']::uuid[]) t;
insert into public.entries (id, user_id, title_id, status, finished_at)
select private.uuid_v7(), ('00000000-0000-7000-8000-0000000000a' || n)::uuid, '20000000-0000-4000-8000-0000000000a1', 'finished', now()
from generate_series(2, 6) n;
insert into public.entries (id, user_id, title_id, status, finished_at)
select private.uuid_v7(), ('00000000-0000-7000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, t, 'finished', now()
from generate_series(1, 11) n,
  unnest(array['20000000-0000-4000-8000-0000000000a2', '20000000-0000-4000-8000-0000000000a5']::uuid[]) t;

-- Acting as someone (the claims auth.uid() reads).
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;

-- Serves `p_user` a question (about `p_title` first) and answers it, as the server's clock sees it: two seconds
-- later, or (`p_fast`) at once. Returns the answer's result with the question under "question".
create function pg_temp.answer_as(p_user uuid, p_title uuid, p_choice text, p_fast boolean default false)
returns jsonb language plpgsql as $$
declare
  served jsonb;
begin
  perform pg_temp.as_user(p_user);
  served := public.quiz_next(p_title);
  if not p_fast then
    update public.quiz_answers set served_at = served_at - interval '2 seconds' where id = (served ->> 'id')::uuid;
  end if;
  return public.quiz_answer((served ->> 'id')::uuid, p_choice) || jsonb_build_object('question', served);
end;
$$;

-- Questions served in the quiz tests.
create temporary table served (n integer, body jsonb);
grant all on served to authenticated;

select is(uuid_extract_version(private.uuid_v7()), 7::smallint, 'the database makes UUID v7 ids');

-- ---------------------------------------------------------------------------
-- Topics
-- ---------------------------------------------------------------------------
set local role anon;
select results_eq(
  $$ select count(*)::int, count(*) filter (where quiz)::int from public.warning_topics where active $$,
  $$ values (26, 13) $$,
  'anyone reads the topics (26, 13 of them in the quiz)'
);
select throws_ok(
  $$ insert into public.warning_topics (slug, dtdd_id, kinds) values ('made-up', 99999, '{movie}') $$,
  '42501', null, 'nobody writes topics'
);

-- ---------------------------------------------------------------------------
-- Adding warnings
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, season, episode, start_sec, end_sec)
     values ('01926000-0000-7000-8000-0000000000d1', '20000000-0000-4000-8000-0000000000a1', 'dog-dies', 2, 5, 2470, 2550) $$,
  'a viewer adds a warning with its episode and time'
);
select results_eq(
  $$ select status, confirms, disputes from public.scene_warnings where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values ('pending'::text, 1, 0) $$,
  'it waits for confirmation, counting its adder'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, status)
     values ('01926000-0000-7000-8000-0000000000d2', '20000000-0000-4000-8000-0000000000a1', 'spiders', 'confirmed') $$,
  '42501', null, 'nobody sends a status'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, season, episode)
     values ('01926000-0000-7000-8000-0000000000d3', '20000000-0000-4000-8000-0000000000a2', 'spiders', 1, 1) $$,
  '23514', null, 'a movie has no episodes'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, start_sec)
     values ('01926000-0000-7000-8000-0000000000d4', '20000000-0000-4000-8000-0000000000a3', 'spiders', 60) $$,
  '23514', null, 'a book has chapters and pages, not times'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, unit, position)
     values ('01926000-0000-7000-8000-0000000000d5', '20000000-0000-4000-8000-0000000000a4', 'spiders', 'page', 12) $$,
  '23514', null, 'a manga goes by chapter or volume'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, unit, position)
     values ('01926000-0000-7000-8000-0000000000d6', '20000000-0000-4000-8000-0000000000a3', 'jump-scares', 'chapter', 3) $$,
  '23514', null, 'screen-only topics are not for books'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, start_sec, end_sec)
     values ('01926000-0000-7000-8000-0000000000d8', '20000000-0000-4000-8000-0000000000a2', 'spiders', 600, 500) $$,
  '23514', null, 'a scene ends after it starts'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic)
     values ('01926000-0000-7000-8000-0000000000d9', '20000000-0000-4000-8000-0000000000a2', 'made-up') $$,
  '23503', null, 'only known topics'
);
select lives_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, unit, position)
     values ('01926000-0000-7000-8000-0000000000d7', '20000000-0000-4000-8000-0000000000a3', 'self-harm', 'chapter', 12) $$,
  'a book warning names its chapter'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, season, episode, start_sec, end_sec)
     values ('01926000-0000-7000-8000-0000000000da', '20000000-0000-4000-8000-0000000000a1', 'dog-dies', 2, 5, 2470, 2550) $$,
  '23505', null, 'the same warning twice is refused'
);
select lives_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, season, episode, start_sec)
     values ('01926000-0000-7000-8000-0000000000db', '20000000-0000-4000-8000-0000000000a1', 'jump-scares', 1, 1, 60) $$,
  'another warning on the series'
);
select throws_ok(
  $$ insert into public.scene_warning_votes (id, warning_id, vote)
     values ('01926000-0000-7000-8000-0000000000e1', '01926000-0000-7000-8000-0000000000d1', 1) $$,
  '42501', null, 'nobody votes on their own warning'
);
select throws_ok(
  $$ update public.scene_warnings set status = 'confirmed' where id = '01926000-0000-7000-8000-0000000000d1' $$,
  '42501', null, 'nobody sets a status by hand'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a7", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic)
     values ('01926000-0000-7000-8000-0000000000dc', '20000000-0000-4000-8000-0000000000a1', 'spiders') $$,
  '42501', null, 'only people who watched it add warnings'
);
select throws_ok(
  $$ insert into public.scene_warning_votes (id, warning_id, vote)
     values ('01926000-0000-7000-8000-0000000000e7', '01926000-0000-7000-8000-0000000000d1', 1) $$,
  '42501', null, 'only people who watched it vote'
);
select is_empty($$ select * from public.scene_warnings $$, 'other people''s warnings are not readable directly');

-- ---------------------------------------------------------------------------
-- Votes: the fifth confirmation (its adder counts) confirms a warning.
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a2", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.scene_warning_votes (id, warning_id, vote) values
       ('01926000-0000-7000-8000-0000000000e2', '01926000-0000-7000-8000-0000000000d1', 1),
       ('01926000-0000-7000-8000-0000000000f2', '01926000-0000-7000-8000-0000000000db', -1) $$,
  'someone who finished it confirms one warning and disputes another'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a3", "role": "authenticated"}';
insert into public.scene_warning_votes (id, warning_id, vote) values
  ('01926000-0000-7000-8000-0000000000e3', '01926000-0000-7000-8000-0000000000d1', 1),
  ('01926000-0000-7000-8000-0000000000f3', '01926000-0000-7000-8000-0000000000db', -1);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a4", "role": "authenticated"}';
insert into public.scene_warning_votes (id, warning_id, vote) values
  ('01926000-0000-7000-8000-0000000000e4', '01926000-0000-7000-8000-0000000000d1', 1),
  ('01926000-0000-7000-8000-0000000000f4', '01926000-0000-7000-8000-0000000000db', -1);
select results_eq(
  $$ select status, confirms from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1')
     where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values ('pending'::text, 4) $$,
  'four confirmations are not enough'
);
select throws_ok(
  $$ insert into public.scene_warning_votes (id, warning_id, vote)
     values ('01926000-0000-7000-8000-0000000000e9', '01926000-0000-7000-8000-0000000000d1', -1) $$,
  '23505', null, 'one vote per person'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a5", "role": "authenticated"}';
insert into public.scene_warning_votes (id, warning_id, vote) values
  ('01926000-0000-7000-8000-0000000000e5', '01926000-0000-7000-8000-0000000000d1', 1),
  ('01926000-0000-7000-8000-0000000000f5', '01926000-0000-7000-8000-0000000000db', -1);
select results_eq(
  $$ select status, confirms, disputes from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1')
     where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values ('confirmed'::text, 5, 0) $$,
  'the fifth confirmation confirms it'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a6", "role": "authenticated"}';
insert into public.scene_warning_votes (id, warning_id, vote) values
  ('01926000-0000-7000-8000-0000000000e6', '01926000-0000-7000-8000-0000000000d1', -1),
  ('01926000-0000-7000-8000-0000000000f6', '01926000-0000-7000-8000-0000000000db', -1);
select results_eq(
  $$ select status, confirms, disputes, my_vote, mine from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1')
     where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values ('confirmed'::text, 5, 1, (-1)::smallint, false) $$,
  'a dispute counts, and each person sees their own vote'
);
update public.scene_warning_votes set vote = 1 where id = '01926000-0000-7000-8000-0000000000e6';
select results_eq(
  $$ select confirms, disputes from public.scene_warning_tally('01926000-0000-7000-8000-0000000000d1') $$,
  $$ values (6, 0) $$,
  'a vote can be changed'
);
update public.scene_warning_votes set deleted_at = now() where id = '01926000-0000-7000-8000-0000000000e6';
select results_eq(
  $$ select confirms, my_vote from public.scene_warning_tally('01926000-0000-7000-8000-0000000000d1') $$,
  $$ values (5, null::smallint) $$,
  'and taken back'
);
select results_eq(
  $$ select count(*)::int from public.scene_warning_votes $$,
  $$ values (2) $$,
  'people read only their own votes'
);
select throws_ok(
  $$ delete from public.scene_warning_votes $$,
  '42501', null, 'votes are never hard-deleted'
);
select is_empty(
  $$ select * from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1')
     where id = '01926000-0000-7000-8000-0000000000db' $$,
  'five disputes hide a warning from others'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a1", "role": "authenticated"}';
select results_eq(
  $$ select status, mine from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1') order by status $$,
  $$ values ('confirmed'::text, true), ('disputed'::text, true) $$,
  'its adder still sees a disputed warning, marked as theirs'
);
update public.scene_warnings set deleted_at = now() where id = '01926000-0000-7000-8000-0000000000d1';
select results_eq(
  $$ select count(*)::int from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1')
     where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values (1) $$,
  'a confirmed warning can''t be withdrawn: others rely on it'
);
update public.scene_warnings set deleted_at = now() where id = '01926000-0000-7000-8000-0000000000d7';
select is_empty(
  $$ select * from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a3') $$,
  'a waiting warning can be withdrawn'
);

-- Badges: a2 avoids a dog dying (DTDD 153) and spiders (165).
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a2", "role": "authenticated"}';
insert into public.user_avoid_topics (id, topic_id) values
  ('01926000-0000-7000-8000-00000000a153', 153),
  ('01926000-0000-7000-8000-00000000a165', 165);
select results_eq(
  $$ select title_id::text, topic_id, topic from public.community_avoid_hits(array[
       '20000000-0000-4000-8000-0000000000a1'::uuid, '20000000-0000-4000-8000-0000000000a2'::uuid]) $$,
  $$ values ('20000000-0000-4000-8000-0000000000a1', 153, 'dog-dies') $$,
  'a confirmed warning flags its title for people avoiding the topic'
);

set local role anon;
select throws_ok(
  $$ select * from public.title_scene_warnings('20000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'signed-out visitors don''t read warnings'
);
select throws_ok($$ select public.quiz_next() $$, '42501', null, 'signed-out visitors get no questions');

-- One person adds at most 30 warnings a day (a1 has 3 so far, one of them withdrawn).
reset role;
select lives_ok(
  $$ insert into public.scene_warnings (id, user_id, title_id, topic, start_sec)
     select private.uuid_v7(), '00000000-0000-7000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a1', 'spiders', g
     from generate_series(1, 27) g $$,
  'up to 30 warnings a day'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, user_id, title_id, topic, start_sec)
     values (private.uuid_v7(), '00000000-0000-7000-8000-0000000000a1', '20000000-0000-4000-8000-0000000000a1', 'spiders', 999) $$,
  '23514', null, 'and no more'
);

-- ---------------------------------------------------------------------------
-- The quiz
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000a7", "role": "authenticated"}';
select is(public.quiz_next() ->> 'status', 'no_finishes', 'nothing finished: "finish something first"');
select throws_ok(
  $$ insert into public.quiz_answers (user_id, question_id) values ('00000000-0000-7000-8000-0000000000a7', gen_random_uuid()) $$,
  '42501', null, 'nobody writes answers directly'
);
select throws_ok($$ select * from public.quiz_pauses $$, '42501', null, 'pauses are not readable');

-- b01 answers faster than anyone can read.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-000000000101", "role": "authenticated"}';
insert into served select 1, public.quiz_next('20000000-0000-4000-8000-0000000000a2');
insert into served select 2, public.quiz_next('20000000-0000-4000-8000-0000000000a2');
select results_eq(
  $$ select body ->> 'status', body ->> 'kind', body -> 'title' ->> 'name' from served where n = 1 $$,
  $$ values ('question', 'topic', 'A Movie') $$,
  'a question about a title they finished'
);
select results_eq(
  $$ select count(distinct body ->> 'id')::int from served $$,
  $$ values (1) $$,
  'an unanswered question is served again'
);
select is(
  public.quiz_answer((select (body ->> 'id')::uuid from served where n = 1), 'yes') ->> 'status',
  'too_fast', 'an answer right after serving counts for nothing'
);
select results_eq(
  $$ select counted, too_fast, choice from public.quiz_answers where id = (select (body ->> 'id')::uuid from served where n = 1) $$,
  $$ values (false, true, 'yes'::text) $$,
  'it is kept, not counted'
);
insert into served select 3, public.quiz_next('20000000-0000-4000-8000-0000000000a2');
select isnt(
  (select body ->> 'topic' from served where n = 3), (select body ->> 'topic' from served where n = 1),
  'never the same question twice'
);
reset role;
select is(
  pg_temp.answer_as('00000000-0000-7000-8000-000000000101', '20000000-0000-4000-8000-0000000000a2', 'no', true) ->> 'status',
  'too_fast', 'a second one'
);
select is(
  pg_temp.answer_as('00000000-0000-7000-8000-000000000101', '20000000-0000-4000-8000-0000000000a2', 'no', true) ->> 'status',
  'paused', 'the third in ten minutes pauses the quiz'
);
select is(public.quiz_next() ->> 'status', 'paused', 'a paused quiz serves nothing');

-- b02–b11 answer the first question: 6 yes, 4 no.
select is(
  (select count(*)::int from generate_series(2, 11) n
   where pg_temp.answer_as(('00000000-0000-7000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
     '20000000-0000-4000-8000-0000000000a2', case when n <= 7 then 'yes' else 'no' end) ->> 'status' = 'counted'),
  10, 'ten people who finished it answer'
);
-- (All ten get the same question: the open one with the most answers so far.)
select results_eq(
  $$ select status, yes_count, no_count, resolved_at is not null from public.quiz_questions
     where title_id = '20000000-0000-4000-8000-0000000000a2' and yes_count + no_count > 0 $$,
  $$ values ('yes'::text, 6, 4, true) $$,
  'the tenth counted answer resolves it: 6 yes, 4 no is a yes'
);
-- …and 5–5 on the other movie is contested.
select is(
  (select count(*)::int from generate_series(2, 11) n
   where pg_temp.answer_as(('00000000-0000-7000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid,
     '20000000-0000-4000-8000-0000000000a5', case when n <= 6 then 'yes' else 'no' end) ->> 'status' = 'counted'),
  10, 'ten answer about the other movie'
);
select results_eq(
  $$ select status, yes_count, no_count from public.quiz_questions where title_id = '20000000-0000-4000-8000-0000000000a5' $$,
  $$ values ('contested'::text, 5, 5) $$,
  '5–5 is contested'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-000000000111", "role": "authenticated"}';
select ok(
  public.quiz_next(null, '{spiders,needles}') ->> 'topic' in ('spiders', 'needles'),
  'only topics the app has words for are asked'
);
select is(public.quiz_next(null, '{}') ->> 'status', 'done', 'with none, nothing is');

-- A quiz "yes" flags titles like a confirmed warning.
insert into public.user_avoid_topics (id, user_id, topic_id)
select private.uuid_v7(), '00000000-0000-7000-8000-000000000102', t.dtdd_id
from public.quiz_questions q join public.warning_topics t on t.slug = q.topic
where q.status = 'yes' and q.title_id = '20000000-0000-4000-8000-0000000000a2';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-000000000102", "role": "authenticated"}';
select results_eq(
  $$ select title_id::text from public.community_avoid_hits(array['20000000-0000-4000-8000-0000000000a2'::uuid]) $$,
  $$ values ('20000000-0000-4000-8000-0000000000a2') $$,
  'a resolved "yes" flags the title for people avoiding the topic'
);
select results_eq(
  $$ select count(*)::int, count(distinct user_id)::int from public.quiz_answers $$,
  $$ values (2, 1) $$,
  'people read only their own answers'
);

-- Waiting warnings go to people who finished the title: a "yes" is a confirmation, "don't remember" nothing.
reset role;
select results_eq(
  $$ select r ->> 'kind', r ->> 'status', (r ->> 'confirms')::int
     from pg_temp.answer_as('00000000-0000-7000-8000-0000000000a2', '20000000-0000-4000-8000-0000000000a1', 'yes') r $$,
  $$ values ('warning', 'counted', 2) $$,
  'the quiz asks people who finished it to confirm a waiting warning'
);
select results_eq(
  $$ select count(*)::int from public.scene_warning_votes v
     join public.scene_warnings w on w.id = v.warning_id
     where v.user_id = '00000000-0000-7000-8000-0000000000a2' and v.vote = 1 and w.topic = 'spiders' $$,
  $$ values (1) $$,
  'that answer is a vote'
);
select results_eq(
  $$ select r ->> 'status', r -> 'question' ->> 'kind'
     from pg_temp.answer_as('00000000-0000-7000-8000-0000000000a3', '20000000-0000-4000-8000-0000000000a1', 'unsure') r $$,
  $$ values ('not_counted', 'warning') $$,
  '"don''t remember" is kept but counts for nothing'
);

-- Accounts: deleting one takes its votes along (the warning is recounted); an adder's warnings stay, anonymous.
delete from auth.users where id = '00000000-0000-7000-8000-0000000000a2';
select results_eq(
  $$ select status, confirms from public.scene_warnings where id = '01926000-0000-7000-8000-0000000000d1' $$,
  $$ values ('pending'::text, 4) $$,
  'a deleted account''s votes are gone and the warning is recounted'
);
delete from auth.users where id = '00000000-0000-7000-8000-0000000000a1';
select results_eq(
  $$ select count(*)::int from public.scene_warnings where user_id is null and deleted_at is null $$,
  $$ values (29) $$,
  'warnings outlive their adder''s account, without the account'
);

select * from finish();
rollback;
