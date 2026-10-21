-- pgTAP tests for rankings in the feed (ADR 0099, step 3): `following_rankings` lists the shared ranking and tier list
-- cards of the people the caller follows and their own, newest first; never a private or blocked profile's, an
-- unfollowed one's, an unshared, deleted or image-less card, or another kind of card. Run with `pnpm db:test`.
begin;
select plan(10);

-- a: the viewer. b: followed, public. c: followed, private. d: followed, blocked by a. e: not followed. f: unfollowed.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000d0a', 'rankfeed_a@example.com'),
  ('00000000-0000-7000-8000-000000000d0b', 'rankfeed_b@example.com'),
  ('00000000-0000-7000-8000-000000000d0c', 'rankfeed_c@example.com'),
  ('00000000-0000-7000-8000-000000000d0d', 'rankfeed_d@example.com'),
  ('00000000-0000-7000-8000-000000000d0e', 'rankfeed_e@example.com'),
  ('00000000-0000-7000-8000-000000000d0f', 'rankfeed_f@example.com');
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-000000000d0c';
insert into public.follows (id, follower_id, followee_id, deleted_at) values
  ('01926000-0000-7000-8000-000000000d61', '00000000-0000-7000-8000-000000000d0a', '00000000-0000-7000-8000-000000000d0b', null),
  ('01926000-0000-7000-8000-000000000d62', '00000000-0000-7000-8000-000000000d0a', '00000000-0000-7000-8000-000000000d0c', null),
  ('01926000-0000-7000-8000-000000000d63', '00000000-0000-7000-8000-000000000d0a', '00000000-0000-7000-8000-000000000d0d', null),
  ('01926000-0000-7000-8000-000000000d64', '00000000-0000-7000-8000-000000000d0a', '00000000-0000-7000-8000-000000000d0f', now());
insert into public.blocks (id, blocker_id, blocked_id)
values ('01926000-0000-7000-8000-000000000d51', '00000000-0000-7000-8000-000000000d0a', '00000000-0000-7000-8000-000000000d0d');

-- Cards: b's tier list (newest) and top list, plus an unshared one, a deleted one, one without its PNG and an Atlas card;
-- a's own; one each from c, d, e and f.
insert into public.cards (id, user_id, kind, template_id, size, params, image_path, shared_at, deleted_at) values
  ('01926000-0000-7000-8000-000000000d01', '00000000-0000-7000-8000-000000000d0b', 'tier_list', 'tierBoard', 'story', '{}', '00000000-0000-7000-8000-000000000d0b/01926000-0000-7000-8000-000000000d01.png', now() - interval '1 hour', null),
  ('01926000-0000-7000-8000-000000000d02', '00000000-0000-7000-8000-000000000d0b', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0b/01926000-0000-7000-8000-000000000d02.png', now() - interval '3 hours', null),
  ('01926000-0000-7000-8000-000000000d03', '00000000-0000-7000-8000-000000000d0b', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0b/01926000-0000-7000-8000-000000000d03.png', null, null),
  ('01926000-0000-7000-8000-000000000d04', '00000000-0000-7000-8000-000000000d0b', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0b/01926000-0000-7000-8000-000000000d04.png', now(), now()),
  ('01926000-0000-7000-8000-000000000d05', '00000000-0000-7000-8000-000000000d0b', 'ranking', 'countdown', 'story', '{}', null, now(), null),
  ('01926000-0000-7000-8000-000000000d06', '00000000-0000-7000-8000-000000000d0b', 'atlas', 'atlas', 'story', '{}', '00000000-0000-7000-8000-000000000d0b/01926000-0000-7000-8000-000000000d06.png', now(), null),
  ('01926000-0000-7000-8000-000000000d07', '00000000-0000-7000-8000-000000000d0a', 'ranking', 'hallOfFame', 'feed', '{}', '00000000-0000-7000-8000-000000000d0a/01926000-0000-7000-8000-000000000d07.png', now() - interval '2 hours', null),
  ('01926000-0000-7000-8000-000000000d08', '00000000-0000-7000-8000-000000000d0c', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0c/01926000-0000-7000-8000-000000000d08.png', now(), null),
  ('01926000-0000-7000-8000-000000000d09', '00000000-0000-7000-8000-000000000d0d', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0d/01926000-0000-7000-8000-000000000d09.png', now(), null),
  ('01926000-0000-7000-8000-000000000d10', '00000000-0000-7000-8000-000000000d0e', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0e/01926000-0000-7000-8000-000000000d10.png', now(), null),
  ('01926000-0000-7000-8000-000000000d11', '00000000-0000-7000-8000-000000000d0f', 'ranking', 'countdown', 'story', '{}', '00000000-0000-7000-8000-000000000d0f/01926000-0000-7000-8000-000000000d11.png', now(), null);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000d0a", "role": "authenticated"}';
create temp table r on commit drop as select * from public.following_rankings(null, 10);

select is((select array_agg(card_id order by shared_at desc) from r),
  array['01926000-0000-7000-8000-000000000d01', '01926000-0000-7000-8000-000000000d07', '01926000-0000-7000-8000-000000000d02']::uuid[],
  'the shared rankings of people followed and your own, newest first');
select is((select kind from r where card_id = '01926000-0000-7000-8000-000000000d01'), 'tier_list', 'tier lists too');
select is((select user_id from r where card_id = '01926000-0000-7000-8000-000000000d02'), '00000000-0000-7000-8000-000000000d0b'::uuid,
  'with who made it');
select is((select count(*)::int from r where card_id in ('01926000-0000-7000-8000-000000000d03', '01926000-0000-7000-8000-000000000d04', '01926000-0000-7000-8000-000000000d05')), 0,
  'never unshared, deleted or image-less cards');
select is((select count(*)::int from r where card_id = '01926000-0000-7000-8000-000000000d06'), 0, 'only rankings, not other cards');
select is((select count(*)::int from r where card_id in ('01926000-0000-7000-8000-000000000d08', '01926000-0000-7000-8000-000000000d09')), 0,
  'never a private or blocked profile''s');
select is((select count(*)::int from r where card_id in ('01926000-0000-7000-8000-000000000d10', '01926000-0000-7000-8000-000000000d11')), 0,
  'never someone not followed, or unfollowed');
select is((select array_agg(card_id) from public.following_rankings(now() - interval '90 minutes', 10)),
  array['01926000-0000-7000-8000-000000000d07', '01926000-0000-7000-8000-000000000d02']::uuid[], 'pages by shared time');
select is((select count(*)::int from public.following_rankings(null, 1)), 1, 'takes a limit');
reset role;

set local role anon;
select throws_ok($$ select * from public.following_rankings() $$, '42501', null, 'signed-out visitors get nothing');
reset role;

select * from finish();
rollback;
