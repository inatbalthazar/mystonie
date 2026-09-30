-- pgTAP tests for games (S3 games, ADR 0044): the fifth catalog's titles, a player's hours on an entry, and scene
-- warnings about a whole game. Run with `pnpm db:test`.
begin;
select plan(19);

-- g1 plays and finishes games, g2 is someone else.
insert into auth.users (id, email)
select ('00000000-0000-7000-8000-0000000009a' || n)::uuid, 'games-' || n || '@example.com' from generate_series(1, 2) n;

-- ---------------------------------------------------------------------------
-- Titles: the new kind and source, RAWG's average playtime and platforms
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.titles (id, kind, source, external_id, name, playtime_hours, platforms)
     values ('20000000-0000-4000-8000-0000000009a1', 'game', 'rawg', '990003328', 'A Game', 43, '{PC,PlayStation,Xbox}') $$,
  'a game from RAWG is a title, with its average playtime and platforms'
);
select lives_ok(
  $$ insert into public.titles (id, kind, source, external_id, name)
     values ('20000000-0000-4000-8000-0000000009a2', 'game', 'rawg', '990003329', 'Another Game') $$,
  'playtime and platforms are optional'
);
select is(
  (select platforms from public.titles where id = '20000000-0000-4000-8000-0000000009a2'), '{}'::text[],
  'a title without platforms has an empty list'
);
select throws_ok(
  $$ insert into public.titles (kind, source, external_id, name) values ('podcast', 'rawg', '990000001', 'Nope') $$,
  '23514', null, 'titles take only the known kinds'
);
select throws_ok(
  $$ insert into public.titles (kind, source, external_id, name) values ('game', 'igdb', '990000001', 'Nope') $$,
  '23514', null, 'titles take only the known sources'
);
select throws_ok(
  $$ insert into public.titles (kind, source, external_id, name, playtime_hours) values ('game', 'rawg', '990000002', 'Nope', 0) $$,
  '23514', null, 'an unknown playtime is null, not 0'
);
select throws_ok(
  $$ insert into public.titles (kind, source, external_id, name, platforms) values ('game', 'rawg', '990000003', 'Nope', '{a,b,c,d,e,f,g,h,i}') $$,
  '23514', null, 'at most 8 platforms'
);

-- ---------------------------------------------------------------------------
-- Entries: the hours a player gives
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.entries (id, title_id, status, finished_at, hours_played)
     values ('01926000-0000-7000-8000-0000000009e1', '20000000-0000-4000-8000-0000000009a1', 'finished', now(), 187) $$,
  'a player adds a finished game with the hours it took'
);
select lives_ok(
  $$ update public.entries set hours_played = 190 where id = '01926000-0000-7000-8000-0000000009e1' $$,
  'and changes them later'
);
select is(
  (select hours_played from public.entries where id = '01926000-0000-7000-8000-0000000009e1'), 190::smallint,
  'the hours are saved'
);
select throws_ok(
  $$ update public.entries set hours_played = 0 where id = '01926000-0000-7000-8000-0000000009e1' $$,
  '23514', null, 'hours are 1 or more'
);
select throws_ok(
  $$ update public.entries set hours_played = 10000 where id = '01926000-0000-7000-8000-0000000009e1' $$,
  '23514', null, 'and at most 9,999'
);
select lives_ok(
  $$ update public.entries set hours_played = null where id = '01926000-0000-7000-8000-0000000009e1' $$,
  'null clears them'
);
update public.entries set hours_played = 187 where id = '01926000-0000-7000-8000-0000000009e1';

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
update public.entries set hours_played = 5 where id = '01926000-0000-7000-8000-0000000009e1';
reset role;
select is(
  (select hours_played from public.entries where id = '01926000-0000-7000-8000-0000000009e1'), 187::smallint,
  'nobody changes someone else''s hours'
);
set local role authenticated;

-- ---------------------------------------------------------------------------
-- Scene warnings: every topic fits a game, about the whole game
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select is(
  (select count(*)::int from public.warning_topics where not ('game' = any (kinds))), 0,
  'every topic applies to games'
);
select lives_ok(
  $$ insert into public.scene_warnings (id, title_id, topic) values ('01926000-0000-7000-8000-0000000009d1', '20000000-0000-4000-8000-0000000009a1', 'flashing-lights') $$,
  'someone who played a game warns about it: flashing lights, for the whole game'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, start_sec) values ('01926000-0000-7000-8000-0000000009d2', '20000000-0000-4000-8000-0000000009a1', 'spiders', 60) $$,
  '23514', null, 'a game has no timeline to put a time on'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, unit, position) values ('01926000-0000-7000-8000-0000000009d3', '20000000-0000-4000-8000-0000000009a1', 'spiders', 'chapter', 3) $$,
  '23514', null, 'nor chapters'
);
select throws_ok(
  $$ insert into public.scene_warnings (id, title_id, topic, season, episode) values ('01926000-0000-7000-8000-0000000009d4', '20000000-0000-4000-8000-0000000009a1', 'spiders', 1, 1) $$,
  '23514', null, 'nor episodes'
);

select * from finish();
rollback;
