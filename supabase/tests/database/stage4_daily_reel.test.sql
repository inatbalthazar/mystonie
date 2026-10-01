-- pgTAP tests for Reel of the Day (S4 daily reel, ADR 0048): today's movie stays secret until its day is over, plays
-- are the player's own and only the server writes them, and cards can be Reel of the Day cards. Run with `pnpm db:test`.
begin;
select plan(12);

-- A clean slate for this file (rolled back at the end): local runs may have played today already.
delete from public.reel_plays;
delete from public.daily_reels;

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000007a1', 'reel1@example.com'),
  ('00000000-0000-7000-8000-0000000007a2', 'reel2@example.com');

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000007a1', 'movie', 'tmdb', '990000603', 'Today Film'),
  ('10000000-0000-4000-8000-0000000007a2', 'movie', 'tmdb', '990000604', 'Yesterday Film');

-- The server picks the reels.
set local role service_role;
select lives_ok(
  $$ insert into public.daily_reels (day, number, title_id) values
       ((now() at time zone 'utc')::date, 1000, '10000000-0000-4000-8000-0000000007a1'),
       ((now() at time zone 'utc')::date - 1, 999, '10000000-0000-4000-8000-0000000007a2') $$,
  'the service role picks the reels'
);
select throws_ok(
  $$ insert into public.daily_reels (day, number, title_id) values ((now() at time zone 'utc')::date + 1, 1000, '10000000-0000-4000-8000-0000000007a2') $$,
  '23505', null, 'one number per day'
);
select lives_ok(
  $$ insert into public.reel_plays (id, user_id, day, guesses, solved, finished_at, streak) values
       ('01926000-0000-7000-8000-0000000007b1', '00000000-0000-7000-8000-0000000007a1', (now() at time zone 'utc')::date,
        '[{"externalId": "990000603", "name": "Today Film"}]', true, now(), 1) $$,
  'the service role records a play'
);
select throws_ok(
  $$ insert into public.reel_plays (id, user_id, day, solved) values
       ('01926000-0000-7000-8000-0000000007b2', '00000000-0000-7000-8000-0000000007a2', (now() at time zone 'utc')::date, true) $$,
  '23514', null, 'a solved play is a finished one, with its streak'
);

-- Anyone sees past reels; nobody sees today's.
set local role anon;
select is((select count(*)::int from public.daily_reels), 1, 'anon sees only the reels whose day is over');
select is((select title_id from public.daily_reels), '10000000-0000-4000-8000-0000000007a2'::uuid, 'yesterday''s answer is public');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007a1", "role": "authenticated"}';
select is((select count(*)::int from public.daily_reels where day = (now() at time zone 'utc')::date), 0, 'a player can''t read today''s answer, even after solving it');
select is((select count(*)::int from public.reel_plays), 1, 'a player reads their own play');
select throws_ok(
  $$ update public.reel_plays set solved = true, streak = 99 where user_id = '00000000-0000-7000-8000-0000000007a1' $$,
  '42501', null, 'players can''t change their play'
);
select throws_ok(
  $$ insert into public.reel_plays (id, user_id, day) values
       ('01926000-0000-7000-8000-0000000007b3', '00000000-0000-7000-8000-0000000007a1', (now() at time zone 'utc')::date - 1) $$,
  '42501', null, 'players can''t write plays'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007a2", "role": "authenticated"}';
select is((select count(*)::int from public.reel_plays), 0, 'nobody reads someone else''s play');

reset role;
select lives_ok(
  $$ insert into public.cards (id, user_id, kind, template_id, size, params) values
       ('01926000-0000-7000-8000-0000000007c1', '00000000-0000-7000-8000-0000000007a1', 'reel', 'reel', 'story', '{}') $$,
  'a card can be a Reel of the Day card'
);

select * from finish();
rollback;
