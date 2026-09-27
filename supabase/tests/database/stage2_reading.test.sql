-- pgTAP tests for reading progress (S2 books & manga, ADR 0029). Run with `pnpm db:test`.
-- Users: D (public, the reader), E (public, "someone else"), F (private).
begin;
select plan(18);

select ok((select relrowsecurity from pg_class where oid = 'public.reading_logs'::regclass), 'reading_logs has RLS');

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000d1', 'd1@example.com'),
  ('00000000-0000-7000-8000-0000000000e1', 'e1@example.com'),
  ('00000000-0000-7000-8000-0000000000f1', 'f1@example.com');
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-0000000000f1';

insert into public.titles (id, kind, source, external_id, name, chapter_count, volume_count, page_count) values
  ('20000000-0000-4000-8000-000000000001', 'manga', 'anilist', 'pgtap-reading-manga', 'A Manga', null, null, null),
  ('20000000-0000-4000-8000-000000000002', 'book', 'google_books', 'pgtapBook001', 'A Book', null, null, 320);

select throws_ok($$ insert into public.titles (kind, source, external_id, name, page_count)
  values ('book', 'google_books', 'pgtapBook002', 'Bad', -1) $$, '23514', null, 'lengths are never negative');

-- Rows of E and F, written by the server.
insert into public.reading_logs (id, user_id, title_id, unit, position) values
  ('01926000-0000-7000-8000-0000000000e2', '00000000-0000-7000-8000-0000000000e1', '20000000-0000-4000-8000-000000000001', 'chapter', 10),
  ('01926000-0000-7000-8000-0000000000f2', '00000000-0000-7000-8000-0000000000f1', '20000000-0000-4000-8000-000000000001', 'chapter', 20);

-- ---------------------------------------------------------------------------
-- Signed in as D.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-0000000000d1", "role": "authenticated"}';

select lives_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d2', '20000000-0000-4000-8000-000000000001', 'chapter', 1100) $$,
  'readers log a chapter (user_id defaults to the signed-in user)');
select throws_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d3', '20000000-0000-4000-8000-000000000001', 'chapter', 1100) $$,
  '23505', null, 'the same point is one live checkpoint');
select throws_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('b5a8c1a4-8c2e-4b0e-9d6f-2f3a1c0e9b11', '20000000-0000-4000-8000-000000000002', 'page', 5) $$,
  '23514', null, 'ids must be UUID v7');
select throws_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d4', '20000000-0000-4000-8000-000000000002', 'page', 0) $$,
  '23514', null, 'positions start at 1');
select throws_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d5', '20000000-0000-4000-8000-000000000002', 'episode', 5) $$,
  '23514', null, 'units are page, chapter or volume');
select throws_ok($$ insert into public.reading_logs (id, user_id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d6', '00000000-0000-7000-8000-0000000000e1', '20000000-0000-4000-8000-000000000002', 'page', 5) $$,
  '42501', null, 'nobody logs for someone else');
select throws_ok($$ update public.reading_logs set position = 5 where id = '01926000-0000-7000-8000-0000000000d2' $$,
  '42501', null, 'a checkpoint''s position is fixed (column grants)');
select throws_ok($$ delete from public.reading_logs where id = '01926000-0000-7000-8000-0000000000d2' $$,
  '42501', null, 'no hard deletes from clients');
select lives_ok($$ update public.reading_logs set deleted_at = now() where id = '01926000-0000-7000-8000-0000000000d2' $$,
  'soft delete');
select lives_ok($$ insert into public.reading_logs (id, title_id, unit, position)
  values ('01926000-0000-7000-8000-0000000000d7', '20000000-0000-4000-8000-000000000001', 'chapter', 1100) $$,
  'a removed point can be logged again');

select is((select count(*)::int from public.reading_logs where user_id = '00000000-0000-7000-8000-0000000000e1'), 1,
  'live logs of public profiles are readable');
select is((select count(*)::int from public.reading_logs where user_id = '00000000-0000-7000-8000-0000000000f1'), 0,
  'logs of private profiles are not');

-- Reading Progress cards point at the owner's own log only, and at one source at most.
select lives_ok($$ insert into public.cards (id, kind, reading_log_id, template_id, size)
  values ('01926000-0000-7000-8000-0000000000d8', 'progress', '01926000-0000-7000-8000-0000000000d7', 'boldStats', 'story') $$,
  'a Progress card from the reader''s log');
select throws_ok($$ insert into public.cards (id, kind, reading_log_id, template_id, size)
  values ('01926000-0000-7000-8000-0000000000d9', 'progress', '01926000-0000-7000-8000-0000000000e2', 'boldStats', 'story') $$,
  '23503', null, 'a card cannot point at someone else''s log');

set local role anon;
select is((select count(*)::int from public.reading_logs where user_id::text like '00000000-0000-7000-8000-0000000000%1'), 2,
  'visitors see the live logs of public profiles (D and E), not the private one');

reset role;
select throws_ok($$ insert into public.cards (id, user_id, kind, reading_log_id, episode_log_id, template_id, size)
  select '01926000-0000-7000-8000-0000000000da', '00000000-0000-7000-8000-0000000000d1', 'weekly_recap',
         '01926000-0000-7000-8000-0000000000d7', null, 'collage', 'story' $$,
  '23514', null, 'recap cards have no reading log');

select * from finish();
rollback;
