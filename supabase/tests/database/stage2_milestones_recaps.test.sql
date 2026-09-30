-- pgTAP tests for Milestone cards, Monthly Recap and Year in Review (ADR 0031). Run with `pnpm db:test`.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000d1', 'd1@example.com'),
  ('00000000-0000-7000-8000-0000000000d2', 'd2@example.com'),
  ('00000000-0000-7000-8000-0000000000d4', 'd4@example.com');
update public.profiles set time_zone = 'Asia/Bangkok' where id in ('00000000-0000-7000-8000-0000000000d1', '00000000-0000-7000-8000-0000000000d2');
update public.profiles set time_zone = 'America/New_York' where id = '00000000-0000-7000-8000-0000000000d4';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000000d1', 'movie', 'tmdb', 'pgtap-month-movie', 'A Movie'),
  ('10000000-0000-4000-8000-0000000000d2', 'manga', 'anilist', '990001', 'A Manga');

-- d1 finished a movie in September (Bangkok); d2 only read (a chapter logged in the week of 21–27 Sep);
-- d4 finished one in September, New York time.
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000000d1', '00000000-0000-7000-8000-0000000000d1', '10000000-0000-4000-8000-0000000000d1', 'finished', '2026-09-10 12:00Z'),
  ('01926000-0000-7000-8000-0000000000d4', '00000000-0000-7000-8000-0000000000d4', '10000000-0000-4000-8000-0000000000d1', 'finished', '2026-09-30 20:00Z');
insert into public.reading_logs (id, user_id, title_id, unit, position, read_at) values
  ('01926000-0000-7000-8000-0000000000d2', '00000000-0000-7000-8000-0000000000d2', '10000000-0000-4000-8000-0000000000d2', 'chapter', 12, '2026-09-24 12:00Z');

-- 1 Oct 10:00 in Bangkok = 03:00Z (still 30 Sep in New York).
select results_eq(
  $$ select user_id, month_start from public.monthly_recap_candidates('2026-10-01 03:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000d%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000d1'::uuid, '2026-09-01'::date), ('00000000-0000-7000-8000-0000000000d2'::uuid, '2026-09-01'::date) $$,
  'Bangkok users active last month are due on the 1st from 09:00, reading included'
);
select is_empty(
  $$ select * from public.monthly_recap_candidates('2026-10-01 01:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000d%' $$,
  'nobody is due before 09:00 local'
);
select results_eq(
  $$ select user_id, month_start from public.monthly_recap_candidates('2026-10-01 14:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000d4' $$,
  $$ values ('00000000-0000-7000-8000-0000000000d4'::uuid, '2026-09-01'::date) $$,
  'New York is due at its own 1st, 09:00, with a finish from its own 30 September'
);
select results_eq(
  $$ select user_id from public.weekly_recap_candidates('2026-09-28 03:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000d%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000d2'::uuid) $$,
  'weekly recaps count reading as activity too'
);

insert into public.weekly_recaps (id, user_id, period, week_start, stats) values
  ('01926000-0000-7000-8000-0000000001d1', '00000000-0000-7000-8000-0000000000d1', 'month', '2026-09-01', '{"period": "month"}');
select results_eq(
  $$ select user_id from public.monthly_recap_candidates('2026-10-01 03:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000d%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000d2'::uuid) $$,
  'a month already recapped is not due again'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, period, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001d9', '00000000-0000-7000-8000-0000000000d1', 'month', '2026-09-01', '{}') $$,
  '23505', null, 'one recap per user and month'
);
select lives_ok(
  $$ insert into public.weekly_recaps (id, user_id, period, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001d2', '00000000-0000-7000-8000-0000000000d1', 'month', '2026-06-01', '{}'),
       ('01926000-0000-7000-8000-0000000001d3', '00000000-0000-7000-8000-0000000000d1', 'week', '2026-06-01', '{}') $$,
  'a week and a month may start on the same day (1 June 2026 is a Monday)'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, period, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001d8', '00000000-0000-7000-8000-0000000000d1', 'month', '2026-09-07', '{}') $$,
  '23514', null, 'months start on the 1st'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, period, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001d7', '00000000-0000-7000-8000-0000000000d1', 'year', '2026-01-01', '{}') $$,
  '23514', null, 'only weeks and months are recaps'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000d1", "role": "authenticated"}';

select lives_ok($$insert into public.cards (id, kind, template_id, size, params) values
  ('01926000-0000-7000-8000-0000000002d1', 'milestone', 'stone', 'story', '{"milestone": {"metric": "titles", "value": 100}}'),
  ('01926000-0000-7000-8000-0000000002d2', 'monthly_recap', 'collage', 'story', '{"recap": {"period": "month"}}'),
  ('01926000-0000-7000-8000-0000000002d3', 'year_review', 'yearbook', 'feed', '{"recap": {"period": "year"}}')$$,
  'owners save milestone, monthly recap and Year in Review cards');
select throws_ok($$insert into public.cards (id, entry_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000002d4', '01926000-0000-7000-8000-0000000000d1', 'milestone', 'stone', 'story')$$,
  '23514', null, 'a milestone card has no entry');
select throws_ok($$insert into public.cards (id, entry_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000002d5', '01926000-0000-7000-8000-0000000000d1', 'year_review', 'yearbook', 'story')$$,
  '23514', null, 'a Year in Review card has no entry');

select lives_ok(
  $$ update public.profiles set milestones_seen = '{"titles": 100}' where id = '00000000-0000-7000-8000-0000000000d1' $$,
  'owners record the milestones they have seen'
);
select throws_ok(
  $$ update public.profiles set milestones_seen = '[100]' where id = '00000000-0000-7000-8000-0000000000d1' $$,
  '23514', null, 'milestones_seen is an object'
);
update public.profiles set milestones_seen = '{"titles": 5000}' where id = '00000000-0000-7000-8000-0000000000d2';
select throws_ok(
  $$ select * from public.monthly_recap_candidates(now(), 10) $$,
  '42501', null, 'users cannot list who is due'
);

reset role;
select is(
  (select milestones_seen from public.profiles where id = '00000000-0000-7000-8000-0000000000d1'),
  '{"titles": 100}'::jsonb,
  'the owner''s update landed'
);
select is(
  (select milestones_seen from public.profiles where id = '00000000-0000-7000-8000-0000000000d2'),
  '{}'::jsonb,
  'nobody else''s profile changed'
);

select * from finish();
rollback;
