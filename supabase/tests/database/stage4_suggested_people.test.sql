-- pgTAP tests for Suggested for you on Find people (ADR 0083): only public, unblocked people the caller doesn't follow,
-- with titles in common, people they follow who follow them, a shared club and a country lived in on a public Atlas.
-- Run with `pnpm db:test`.
begin;
select plan(9);

-- a: the viewer. b: shares a title. c: private, shares a title. d: blocked by a. e: followed by a, and follows f.
-- f: followed by e. g: nothing in common, never finished. h: same club and lived in a's country on a public Atlas.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000c0a', 'sugg_a@example.com'),
  ('00000000-0000-7000-8000-000000000c0b', 'sugg_b@example.com'),
  ('00000000-0000-7000-8000-000000000c0c', 'sugg_c@example.com'),
  ('00000000-0000-7000-8000-000000000c0d', 'sugg_d@example.com'),
  ('00000000-0000-7000-8000-000000000c0e', 'sugg_e@example.com'),
  ('00000000-0000-7000-8000-000000000c0f', 'sugg_f@example.com'),
  ('00000000-0000-7000-8000-000000000c10', 'sugg_g@example.com'),
  ('00000000-0000-7000-8000-000000000c11', 'sugg_h@example.com');
update public.profiles set country = 'TH' where id = '00000000-0000-7000-8000-000000000c0a';
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-000000000c0c';
update public.profiles set atlas_public = true where id = '00000000-0000-7000-8000-000000000c11';

insert into public.titles (id, kind, source, external_id, name, year)
values ('10000000-0000-4000-8000-0000000c0001', 'movie', 'tmdb', 'sugg-1', 'Suggest Movie', 2020);
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-000000000ca1', '00000000-0000-7000-8000-000000000c0a', '10000000-0000-4000-8000-0000000c0001', 'finished', now()),
  ('01926000-0000-7000-8000-000000000cb1', '00000000-0000-7000-8000-000000000c0b', '10000000-0000-4000-8000-0000000c0001', 'finished', now()),
  ('01926000-0000-7000-8000-000000000cc1', '00000000-0000-7000-8000-000000000c0c', '10000000-0000-4000-8000-0000000c0001', 'finished', now()),
  ('01926000-0000-7000-8000-000000000cd1', '00000000-0000-7000-8000-000000000c0d', '10000000-0000-4000-8000-0000000c0001', 'finished', now()),
  ('01926000-0000-7000-8000-000000000ce1', '00000000-0000-7000-8000-000000000c0e', '10000000-0000-4000-8000-0000000c0001', 'finished', now());
insert into public.blocks (id, blocker_id, blocked_id)
values ('01926000-0000-7000-8000-000000000c51', '00000000-0000-7000-8000-000000000c0a', '00000000-0000-7000-8000-000000000c0d');
insert into public.follows (id, follower_id, followee_id) values
  ('01926000-0000-7000-8000-000000000c61', '00000000-0000-7000-8000-000000000c0a', '00000000-0000-7000-8000-000000000c0e'),
  ('01926000-0000-7000-8000-000000000c62', '00000000-0000-7000-8000-000000000c0e', '00000000-0000-7000-8000-000000000c0f');
insert into public.club_members (id, user_id, club) values
  ('01926000-0000-7000-8000-000000000c71', '00000000-0000-7000-8000-000000000c0a', 'horror'),
  ('01926000-0000-7000-8000-000000000c72', '00000000-0000-7000-8000-000000000c11', 'horror');
insert into public.places (id, user_id, country, status)
values ('01926000-0000-7000-8000-000000000c81', '00000000-0000-7000-8000-000000000c11', 'TH', 'lived');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000c0a", "role": "authenticated"}';
create temp table s on commit drop as select * from public.suggested_people(20);

select is((select shared from s where id = '00000000-0000-7000-8000-000000000c0b'), 1, 'someone with a title in common is suggested');
select is((select shared_title from s where id = '00000000-0000-7000-8000-000000000c0b'), 'Suggest Movie', '...with that title by name');
select is((select count(*)::int from s where id in ('00000000-0000-7000-8000-000000000c0c', '00000000-0000-7000-8000-000000000c0d')), 0,
  'private and blocked people are never suggested');
select is((select count(*)::int from s where id in ('00000000-0000-7000-8000-000000000c0a', '00000000-0000-7000-8000-000000000c0e')), 0,
  'not yourself, nor anyone you follow');
select is((select mutuals from s where id = '00000000-0000-7000-8000-000000000c0f'), 1, 'followed by someone you follow');
select is((select count(*)::int from s where id = '00000000-0000-7000-8000-000000000c10'), 0, 'nothing in common and nothing finished: not suggested');
select is((select club from s where id = '00000000-0000-7000-8000-000000000c11'), 'horror', 'a club in common');
select is((select country from s where id = '00000000-0000-7000-8000-000000000c11'), 'TH', 'lived in your country, on a public Atlas');
reset role;

set local role anon;
select throws_ok($$ select * from public.suggested_people(10) $$, '42501', null, 'signed-out visitors get nothing');
reset role;

select * from finish();
rollback;
