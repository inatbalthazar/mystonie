-- pgTAP tests for monthly challenges and fandom clubs (S3 challenges & clubs, ADR 0040): people join and leave their
-- own rows; progress and completion are the server's; private and blocked profiles never show, only in totals; the
-- club feed and trending apply the same rules. Run with `pnpm db:test`.
begin;
select plan(28);

-- c1–c3 and c5 are public, c4 is private. c1 blocks c5.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000008c1', 'c1@example.com'),
  ('00000000-0000-7000-8000-0000000008c2', 'c2@example.com'),
  ('00000000-0000-7000-8000-0000000008c3', 'c3@example.com'),
  ('00000000-0000-7000-8000-0000000008c4', 'c4@example.com'),
  ('00000000-0000-7000-8000-0000000008c5', 'c5@example.com');
update public.profiles set username = 'pgtap_cora' where id = '00000000-0000-7000-8000-0000000008c1';
update public.profiles set username = 'pgtap_cal' where id = '00000000-0000-7000-8000-0000000008c2';
update public.profiles set username = 'pgtap_cy' where id = '00000000-0000-7000-8000-0000000008c3';
update public.profiles set username = 'pgtap_cass', visibility = 'private' where id = '00000000-0000-7000-8000-0000000008c4';
update public.profiles set username = 'pgtap_cole' where id = '00000000-0000-7000-8000-0000000008c5';

insert into public.titles (id, kind, source, external_id, name, original_language, genres) values
  ('10000000-0000-4000-8000-0000000008a1', 'series', 'tmdb', '990000081', 'Pgtap Seoul Story', 'ko', '{Drama}'),
  ('10000000-0000-4000-8000-0000000008a2', 'movie', 'tmdb', '990000082', 'Pgtap Elsewhere', 'en', '{Drama}'),
  ('10000000-0000-4000-8000-0000000008a3', 'series', 'tmdb', '990000083', 'Pgtap Busan Nights', 'ko', '{Crime}');

-- ---------------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.challenge_joins (id, month, slug) values
       ('01926000-0000-7000-8000-0000000008b1', date_trunc('month', now())::date, 'finish-four') $$,
  'people join a challenge of this month'
);
select throws_ok(
  $$ insert into public.challenge_joins (id, month, slug) values
       ('01926000-0000-7000-8000-0000000008b2', date_trunc('month', now())::date, 'finish-four') $$,
  '23505', null, 'one live join per challenge'
);
select throws_ok(
  $$ insert into public.challenge_joins (id, month, slug) values
       ('01926000-0000-7000-8000-0000000008b3', (date_trunc('month', now()) - interval '3 months')::date, 'finish-four') $$,
  '42501', null, 'months long gone cannot be joined'
);
select throws_ok(
  $$ insert into public.challenge_joins (id, month, slug, progress) values
       ('01926000-0000-7000-8000-0000000008b4', date_trunc('month', now())::date, 'twelve-days', 12) $$,
  '42501', null, 'clients cannot set their progress'
);
select throws_ok(
  $$ update public.challenge_joins set completed_at = now() where id = '01926000-0000-7000-8000-0000000008b1' $$,
  '42501', null, 'clients cannot complete a challenge'
);
select throws_ok(
  $$ insert into public.challenge_joins (id, user_id, month, slug) values
       ('01926000-0000-7000-8000-0000000008b5', '00000000-0000-7000-8000-0000000008c2', date_trunc('month', now())::date, 'twelve-days') $$,
  '42501', null, 'nobody joins for someone else'
);

-- Leaving is a soft delete; joining again is a new row.
update public.challenge_joins set deleted_at = now() where id = '01926000-0000-7000-8000-0000000008b1';
select isnt((select deleted_at from public.challenge_joins where id = '01926000-0000-7000-8000-0000000008b1'), null, 'people leave a challenge');
select lives_ok(
  $$ insert into public.challenge_joins (id, month, slug) values
       ('01926000-0000-7000-8000-0000000008b6', date_trunc('month', now())::date, 'finish-four') $$,
  'and can join it again'
);

-- The server records progress and completion; a completed challenge can't be left or deleted.
reset role;
update public.challenge_joins set progress = 4, completed_at = now(), title_id = '10000000-0000-4000-8000-0000000008a1'
where id = '01926000-0000-7000-8000-0000000008b6';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c1", "role": "authenticated"}';
update public.challenge_joins set deleted_at = now() where id = '01926000-0000-7000-8000-0000000008b6';
select is((select deleted_at from public.challenge_joins where id = '01926000-0000-7000-8000-0000000008b6'), null, 'a completed challenge cannot be left');
select throws_ok(
  $$ delete from public.challenge_joins where id = '01926000-0000-7000-8000-0000000008b6' $$,
  '42501', null, 'clients cannot delete joins'
);

-- The private c4 joins too; c1 blocks c5.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c4", "role": "authenticated"}';
insert into public.challenge_joins (id, month, slug) values
  ('01926000-0000-7000-8000-0000000008b7', date_trunc('month', now())::date, 'finish-four');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c1", "role": "authenticated"}';
insert into public.blocks (id, blocked_id) values ('01926000-0000-7000-8000-0000000008d1', '00000000-0000-7000-8000-0000000008c5');

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c2", "role": "authenticated"}';
select results_eq(
  $$ select user_id from public.challenge_joins where slug = 'finish-four' and month = date_trunc('month', now())::date $$,
  $$ values ('00000000-0000-7000-8000-0000000008c1'::uuid) $$,
  'others see the live joins of public profiles only (not left ones, not private ones)'
);
select results_eq(
  $$ select joined, completed from public.challenge_counts(date_trunc('month', now())::date) where slug = 'finish-four' $$,
  $$ values (2, 1) $$,
  'the totals count private people too'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c5", "role": "authenticated"}';
select is((select count(*)::int from public.challenge_joins where user_id = '00000000-0000-7000-8000-0000000008c1'), 0, 'a blocked person sees none of the blocker''s joins');

reset role;
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.challenge_joins where user_id = '00000000-0000-7000-8000-0000000008c1'), 1, 'signed-out visitors see a public profile''s patches');
select throws_ok(
  $$ insert into public.challenge_joins (id, month, slug) values ('01926000-0000-7000-8000-0000000008b8', date_trunc('month', now())::date, 'finish-four') $$,
  '42501', null, 'signed-out visitors cannot join'
);

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.club_members (id, club) values ('01926000-0000-7000-8000-0000000008e1', 'kdrama') $$,
  'people join a club'
);
select throws_ok(
  $$ insert into public.club_members (id, club) values ('01926000-0000-7000-8000-0000000008e2', 'kdrama') $$,
  '23505', null, 'one live membership per club'
);
select throws_ok(
  $$ insert into public.club_members (id, user_id, club) values ('01926000-0000-7000-8000-0000000008e3', '00000000-0000-7000-8000-0000000008c2', 'kdrama') $$,
  '42501', null, 'nobody joins a club for someone else'
);
select throws_ok(
  $$ insert into public.club_members (id, club) values ('01926000-0000-7000-8000-0000000008e4', 'K-Drama!') $$,
  '23514', null, 'club slugs have one format'
);
-- c1 finished a Korean series and an English movie.
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008f1', '00000000-0000-7000-8000-0000000008c1', '10000000-0000-4000-8000-0000000008a1', 'finished', now() - interval '2 days'),
  ('01926000-0000-7000-8000-0000000008f2', '00000000-0000-7000-8000-0000000008c1', '10000000-0000-4000-8000-0000000008a2', 'finished', now() - interval '1 day');

-- c3 (public) and c4 (private) join and finish Korean series too; c2 finished one without joining.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c3", "role": "authenticated"}';
insert into public.club_members (id, club) values ('01926000-0000-7000-8000-0000000008e5', 'kdrama');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008f3', '00000000-0000-7000-8000-0000000008c3', '10000000-0000-4000-8000-0000000008a1', 'finished', now() - interval '3 days');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c4", "role": "authenticated"}';
insert into public.club_members (id, club) values ('01926000-0000-7000-8000-0000000008e6', 'kdrama');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008f4', '00000000-0000-7000-8000-0000000008c4', '10000000-0000-4000-8000-0000000008a1', 'finished', now() - interval '4 days'),
  ('01926000-0000-7000-8000-0000000008f5', '00000000-0000-7000-8000-0000000008c4', '10000000-0000-4000-8000-0000000008a3', 'finished', now() - interval '4 days');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c2", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008f6', '00000000-0000-7000-8000-0000000008c2', '10000000-0000-4000-8000-0000000008a3', 'finished', now() - interval '1 day');

select results_eq(
  $$ select user_id from public.club_members where club = 'kdrama' order by user_id $$,
  $$ values ('00000000-0000-7000-8000-0000000008c1'::uuid), ('00000000-0000-7000-8000-0000000008c3'::uuid) $$,
  'others see the public members only'
);
select results_eq(
  $$ select members from public.club_counts() where club = 'kdrama' $$,
  $$ values (3) $$,
  'the member total counts private members too'
);
select results_eq(
  $$ select entry_id from public.club_feed('kdrama', '{series}', null, '{ko}') $$,
  $$ values ('01926000-0000-7000-8000-0000000008f1'::uuid), ('01926000-0000-7000-8000-0000000008f3'::uuid) $$,
  'the club feed: public members'' finishes that fit the club, newest first (no private members, no non-members, nothing that doesn''t fit)'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c4", "role": "authenticated"}';
select is((select count(*)::int from public.club_feed('kdrama', '{series}', null, '{ko}') where user_id = '00000000-0000-7000-8000-0000000008c4'), 2, 'a private member sees their own finishes in the club');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c5", "role": "authenticated"}';
select is((select count(*)::int from public.club_feed('kdrama', '{series}', null, '{ko}') where user_id = '00000000-0000-7000-8000-0000000008c1'), 0, 'a blocked person sees none of the blocker''s finishes');
select results_eq(
  $$ select title_id, people from public.club_trending('kdrama', '{series}', null, '{ko}') $$,
  $$ values ('10000000-0000-4000-8000-0000000008a1'::uuid, 3) $$,
  'club trending: titles 3 members were on, private ones counted (a title with fewer, or from non-members, is left out)'
);
select throws_ok(
  $$ select private.title_fits('series', '{}', 'ko', null, null, null) $$,
  '42501', null, 'the filter helper is not callable by clients'
);

-- Leaving a club is a soft delete.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008c3", "role": "authenticated"}';
update public.club_members set deleted_at = now() where club = 'kdrama' and user_id = '00000000-0000-7000-8000-0000000008c3';
reset role;
select is((select members from public.club_counts() where club = 'kdrama'), 2, 'people leave a club');

-- Challenge cards may be saved.
select ok(
  (select pg_get_constraintdef(oid) like '%challenge%' from pg_constraint where conname = 'cards_kind_check'),
  'cards can be Challenge cards'
);

select * from finish();
rollback;
