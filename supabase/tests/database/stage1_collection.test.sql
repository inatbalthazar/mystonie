-- pgTAP tests for the stage 1 collection tables. Run with `pnpm db:test` (local stack must be running).
-- Users: A (public), B (public, the "someone else"), C (private).
begin;
select plan(41);

select ok((select bool_and(relrowsecurity) from pg_class
  where oid in ('public.entries'::regclass, 'public.episode_logs'::regclass,
                'public.title_episodes'::regclass, 'public.cards'::regclass)),
  'every collection table has RLS');

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-00000000000a', 'a@example.com'),
  ('00000000-0000-7000-8000-00000000000b', 'b@example.com'),
  ('00000000-0000-7000-8000-00000000000c', 'c@example.com');
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-00000000000c';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-000000000001', 'movie', 'tmdb', 'pgtap-collection-movie', 'A Movie'),
  ('10000000-0000-4000-8000-000000000002', 'series', 'tmdb', 'pgtap-collection-series', 'A Series');
insert into public.title_episodes (title_id, season, episode, name, runtime_min) values
  ('10000000-0000-4000-8000-000000000002', 1, 1, 'Pilot', 50);

-- Rows of B and C, written by the server.
insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000b1', '00000000-0000-7000-8000-00000000000b',
   '10000000-0000-4000-8000-000000000001', 'want'),
  ('01926000-0000-7000-8000-0000000000c1', '00000000-0000-7000-8000-00000000000c',
   '10000000-0000-4000-8000-000000000001', 'watching');
insert into public.cards (id, user_id, entry_id, kind, template_id, size, shared_at) values
  ('01926000-0000-7000-8000-0000000000c2', '00000000-0000-7000-8000-00000000000c',
   '01926000-0000-7000-8000-0000000000c1', 'progress', 'ticket', 'story', now()),
  ('01926000-0000-7000-8000-0000000000c3', '00000000-0000-7000-8000-00000000000c',
   '01926000-0000-7000-8000-0000000000c1', 'progress', 'ticket', 'story', null);

-- ---------------------------------------------------------------------------
-- Signed in as A.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-00000000000a", "role": "authenticated"}';

select lives_ok($$insert into public.entries (id, title_id, status, finished_at, rating, review)
  values ('01926000-0000-7000-8000-0000000000a1', '10000000-0000-4000-8000-000000000001', 'finished', now(), 4.5, 'Loved it')$$,
  'owners add a finished entry (user_id defaults to the signed-in user)');
select is((select user_id::text from public.entries where id = '01926000-0000-7000-8000-0000000000a1'),
  '00000000-0000-7000-8000-00000000000a', 'user_id is the signed-in user');
select throws_ok($$insert into public.entries (id, title_id, status) values
  ('b5a8c1a4-8c2e-4b0e-9d6f-2f3a1c0e9b11', '10000000-0000-4000-8000-000000000002', 'want')$$,
  '23514', null, 'ids must be UUID v7');
select throws_ok($$insert into public.entries (id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000a2', '10000000-0000-4000-8000-000000000001', 'want')$$,
  '23505', null, 'one live entry per title');
select throws_ok($$insert into public.entries (id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000a3', '10000000-0000-4000-8000-000000000002', 'finished')$$,
  '23514', null, 'a finished entry needs finished_at');
select throws_ok($$insert into public.entries (id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000000a4', '10000000-0000-4000-8000-000000000002', 'want', now())$$,
  '23514', null, 'only finished entries have finished_at');
select throws_ok($$insert into public.entries (id, title_id, status, rating) values
  ('01926000-0000-7000-8000-0000000000a5', '10000000-0000-4000-8000-000000000002', 'want', 4.3)$$,
  '23514', null, 'ratings go in half-star steps');
select throws_ok($$insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000a6', '00000000-0000-7000-8000-00000000000b',
   '10000000-0000-4000-8000-000000000002', 'want')$$,
  '42501', null, 'users cannot add entries for someone else');
select throws_ok($$update public.entries set title_id = '10000000-0000-4000-8000-000000000002'
  where id = '01926000-0000-7000-8000-0000000000a1'$$, '42501', null, 'the title of an entry is fixed');
select throws_ok($$update public.entries set updated_at = now() - interval '1 day'$$,
  '42501', null, 'updated_at is server-owned');
select throws_ok($$delete from public.entries where id = '01926000-0000-7000-8000-0000000000a1'$$,
  '42501', null, 'clients cannot hard-delete');

-- Episodes: log S1E4, no duplicates, soft delete frees the slot again.
select lives_ok($$insert into public.episode_logs (id, title_id, season, episode, runtime_min) values
  ('01926000-0000-7000-8000-0000000000a7', '10000000-0000-4000-8000-000000000002', 1, 4, 50)$$,
  'owners log an episode');
select throws_ok($$insert into public.episode_logs (id, title_id, season, episode) values
  ('01926000-0000-7000-8000-0000000000a8', '10000000-0000-4000-8000-000000000002', 1, 4)$$,
  '23505', null, 'an episode is logged once');
select lives_ok($$update public.episode_logs set deleted_at = now() where id = '01926000-0000-7000-8000-0000000000a7'$$,
  'owners soft-delete an episode log');
select lives_ok($$insert into public.episode_logs (id, title_id, season, episode) values
  ('01926000-0000-7000-8000-0000000000a8', '10000000-0000-4000-8000-000000000002', 1, 4)$$,
  'a soft-deleted episode can be logged again');
select is((select count(*)::int from public.episode_logs where user_id = '00000000-0000-7000-8000-00000000000a'), 2,
  'owners still see their deleted rows (sync tombstones)');

-- Cards.
select lives_ok($$insert into public.cards (id, entry_id, kind, template_id, size, params, image_path) values
  ('01926000-0000-7000-8000-0000000000a9', '01926000-0000-7000-8000-0000000000a1', 'finish', 'boldStats', 'feed',
   '{"hide": ["username"]}',
   '00000000-0000-7000-8000-00000000000a/01926000-0000-7000-8000-0000000000a9.png')$$,
  'owners save a finish card for their entry');
select lives_ok($$insert into public.cards (id, episode_log_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000aa', '01926000-0000-7000-8000-0000000000a8', 'progress', 'ticket', 'story')$$,
  'owners save a progress card for their episode log');
select throws_ok($$insert into public.cards (id, entry_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000ab', '01926000-0000-7000-8000-0000000000b1', 'finish', 'ticket', 'story')$$,
  '23503', null, 'a card cannot point at someone else''s entry');
select throws_ok($$insert into public.cards (id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000ac', 'finish', 'ticket', 'story')$$,
  '23514', null, 'a finish card needs an entry');
select throws_ok($$insert into public.cards (id, entry_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000ad', '01926000-0000-7000-8000-0000000000a1', 'weekly_recap', 'ticket', 'story')$$,
  '23514', null, 'a weekly recap card has no entry');
select throws_ok($$update public.cards set image_path = '00000000-0000-7000-8000-00000000000b/x.png'
  where id = '01926000-0000-7000-8000-0000000000a9'$$,
  '23514', null, 'card images live in the owner''s folder');
select throws_ok($$update public.cards set params = '[1, 2]' where id = '01926000-0000-7000-8000-0000000000a9'$$,
  '23514', null, 'card params are an object');

select throws_ok($$insert into public.title_episodes (title_id, season, episode) values
  ('10000000-0000-4000-8000-000000000002', 1, 2)$$, '42501', null, 'users cannot write the episode cache');

-- ---------------------------------------------------------------------------
-- Signed in as B: A is public, C is private.
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-00000000000b", "role": "authenticated"}';

select is((select count(*)::int from public.entries where user_id = '00000000-0000-7000-8000-00000000000a'), 1,
  'others read the entries of a public profile');
select is((select count(*)::int from public.episode_logs where user_id = '00000000-0000-7000-8000-00000000000a'), 1,
  'others do not see deleted episode logs');
select is((select count(*)::int from public.entries where user_id = '00000000-0000-7000-8000-00000000000c'), 0,
  'others cannot read the entries of a private profile');
select is((select count(*)::int from public.cards where user_id = '00000000-0000-7000-8000-00000000000a'), 0,
  'unshared cards are private');
select is((select count(*)::int from public.cards where user_id = '00000000-0000-7000-8000-00000000000c'), 0,
  'the shared cards of a private profile cannot be listed');
select is((select id::text from public.shared_card('01926000-0000-7000-8000-0000000000c2')),
  '01926000-0000-7000-8000-0000000000c2', 'a shared card link works even when the profile is private');
update public.entries set review = 'hacked' where id = '01926000-0000-7000-8000-0000000000a1';
update public.cards set shared_at = now() where id = '01926000-0000-7000-8000-0000000000a9';

-- ---------------------------------------------------------------------------
-- Signed out.
-- ---------------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.entries where user_id in
  ('00000000-0000-7000-8000-00000000000a', '00000000-0000-7000-8000-00000000000c')), 1,
  'anon reads entries of public profiles only');
select is((select name from public.title_episodes where title_id = '10000000-0000-4000-8000-000000000002'), 'Pilot',
  'anon reads the episode cache');
select throws_ok($$insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000ae', '00000000-0000-7000-8000-00000000000a',
   '10000000-0000-4000-8000-000000000002', 'want')$$, '42501', null, 'anon cannot add entries');
reset role;

select is((select review from public.entries where id = '01926000-0000-7000-8000-0000000000a1'), 'Loved it',
  'others cannot update an entry');
select is((select shared_at from public.cards where id = '01926000-0000-7000-8000-0000000000a9'), null,
  'others cannot share a card');

-- A goes private: B loses access.
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-00000000000a';
set local role authenticated;
select is((select count(*)::int from public.entries where user_id = '00000000-0000-7000-8000-00000000000a'), 0,
  'entries disappear when the profile turns private');
reset role;

-- Account deletion cascades through everything.
delete from auth.users where id = '00000000-0000-7000-8000-00000000000a';
select is((select count(*)::int from public.entries where user_id = '00000000-0000-7000-8000-00000000000a'), 0,
  'deleting the account deletes its entries');
select is((select count(*)::int from public.episode_logs where user_id = '00000000-0000-7000-8000-00000000000a'), 0,
  'deleting the account deletes its episode logs');
select is((select count(*)::int from public.cards where user_id = '00000000-0000-7000-8000-00000000000a'), 0,
  'deleting the account deletes its cards');
select is((select count(*)::int from public.entries where user_id = '00000000-0000-7000-8000-00000000000b'), 1,
  'other accounts are untouched');

select * from finish();
rollback;
