-- pgTAP tests for weekly recaps (ADR 0025). Run with `pnpm db:test` (local stack must be running).
begin;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000e1', 'e1@example.com'),
  ('00000000-0000-7000-8000-0000000000e2', 'e2@example.com'),
  ('00000000-0000-7000-8000-0000000000e3', 'e3@example.com'),
  ('00000000-0000-7000-8000-0000000000e4', 'e4@example.com');
update public.profiles set time_zone = 'Asia/Bangkok' where id in (
  '00000000-0000-7000-8000-0000000000e1', '00000000-0000-7000-8000-0000000000e2', '00000000-0000-7000-8000-0000000000e3');
update public.profiles set time_zone = 'America/New_York' where id = '00000000-0000-7000-8000-0000000000e4';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000000e1', 'series', 'tmdb', 'pgtap-recap-series', 'A Series'),
  ('10000000-0000-4000-8000-0000000000e2', 'movie', 'tmdb', 'pgtap-recap-movie', 'A Movie');

-- The Bangkok week of Mon 21 – Sun 27 Sep 2026 is [2026-09-20 17:00Z, 2026-09-27 17:00Z).
insert into public.episode_logs (id, user_id, title_id, season, episode, watched_at) values
  ('01926000-0000-7000-8000-0000000000e1', '00000000-0000-7000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', 1, 1, '2026-09-24 12:00Z'),
  -- e3: Sunday 23:00 the week before (Bangkok), so nothing in the recap week.
  ('01926000-0000-7000-8000-0000000000e3', '00000000-0000-7000-8000-0000000000e3', '10000000-0000-4000-8000-0000000000e1', 1, 1, '2026-09-20 16:00Z'),
  ('01926000-0000-7000-8000-0000000000e4', '00000000-0000-7000-8000-0000000000e4', '10000000-0000-4000-8000-0000000000e1', 1, 1, '2026-09-24 12:00Z');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000000f2', '00000000-0000-7000-8000-0000000000e2', '10000000-0000-4000-8000-0000000000e2', 'finished', '2026-09-26 12:00Z');

-- Monday 28 Sep 10:00 in Bangkok (still Sunday 23:00 in New York).
select results_eq(
  $$ select user_id, week_start from public.weekly_recap_candidates('2026-09-28 03:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000e%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000e1'::uuid, '2026-09-21'::date), ('00000000-0000-7000-8000-0000000000e2'::uuid, '2026-09-21'::date) $$,
  'Bangkok users who watched last week are due on Monday from 09:00'
);
select is_empty(
  $$ select * from public.weekly_recap_candidates('2026-09-28 01:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000e%' $$,
  'nobody is due before 09:00 local'
);
select results_eq(
  $$ select user_id, week_start from public.weekly_recap_candidates('2026-09-28 15:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000e%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000e1'::uuid, '2026-09-21'::date), ('00000000-0000-7000-8000-0000000000e2'::uuid, '2026-09-21'::date),
            ('00000000-0000-7000-8000-0000000000e4'::uuid, '2026-09-21'::date) $$,
  'New York is due at its own Monday 09:00 (13:00Z)'
);

insert into public.weekly_recaps (id, user_id, week_start, stats) values
  ('01926000-0000-7000-8000-0000000001e1', '00000000-0000-7000-8000-0000000000e1', '2026-09-21', '{"minutes": 45}');
select results_eq(
  $$ select user_id from public.weekly_recap_candidates('2026-09-28 03:00Z', 100) where user_id::text like '00000000-0000-7000-8000-0000000000e%' $$,
  $$ values ('00000000-0000-7000-8000-0000000000e2'::uuid) $$,
  'a week already recapped is not due again'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001e9', '00000000-0000-7000-8000-0000000000e1', '2026-09-21', '{}') $$,
  '23505', null, 'one recap per user and week'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001e8', '00000000-0000-7000-8000-0000000000e1', '2026-09-22', '{}') $$,
  '23514', null, 'weeks start on a Monday'
);

update public.profiles set email_recaps = false where id = '00000000-0000-7000-8000-0000000000e2';
insert into public.weekly_recaps (id, user_id, week_start, stats) values
  ('01926000-0000-7000-8000-0000000001e2', '00000000-0000-7000-8000-0000000000e2', '2026-09-21', '{"minutes": 90}');
select results_eq(
  $$ select id, email, locale from public.weekly_recaps_to_notify(100) where user_id::text like '00000000-0000-7000-8000-0000000000e%' $$,
  $$ values ('01926000-0000-7000-8000-0000000001e1'::uuid, 'e1@example.com', 'en') $$,
  'unsent recaps come with the address, except for people who turned recap emails off'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000e1", "role": "authenticated"}';
select results_eq(
  $$ select id from public.weekly_recaps $$,
  $$ values ('01926000-0000-7000-8000-0000000001e1'::uuid) $$,
  'owners read only their own recaps'
);
select throws_ok(
  $$ insert into public.weekly_recaps (id, user_id, week_start, stats) values
       ('01926000-0000-7000-8000-0000000001e7', '00000000-0000-7000-8000-0000000000e1', '2026-09-14', '{}') $$,
  '42501', null, 'users cannot create recaps'
);
select throws_ok(
  $$ update public.weekly_recaps set notified_at = now() $$,
  '42501', null, 'users cannot change recaps'
);
select throws_ok(
  $$ select * from public.weekly_recap_candidates(now(), 10) $$,
  '42501', null, 'users cannot list who is due'
);
select lives_ok(
  $$ update public.profiles set email_recaps = false where id = '00000000-0000-7000-8000-0000000000e1' $$,
  'owners can turn recap emails off'
);

set local role anon;
select is_empty($$ select * from public.weekly_recaps $$, 'anonymous visitors see no recaps');

reset role;
select is(
  (select schedule from cron.job where jobname = 'weekly-recaps'),
  '5 * * * *',
  'the recap job runs hourly'
);

select * from finish();
rollback;
