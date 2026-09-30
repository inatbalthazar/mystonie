-- pgTAP tests for Finisher #N and trending (S3 finishers & the board, ADR 0039): numbers are handed out by the
-- database, once per person and title, for good; trending shows counts only, from 3 people up. Run with
-- `pnpm db:test`.
begin;
select plan(24);

-- f1–f3 are public, f4 is private.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000007f1', 'f1@example.com'),
  ('00000000-0000-7000-8000-0000000007f2', 'f2@example.com'),
  ('00000000-0000-7000-8000-0000000007f3', 'f3@example.com'),
  ('00000000-0000-7000-8000-0000000007f4', 'f4@example.com');
update public.profiles set username = 'pgtap_fay' where id = '00000000-0000-7000-8000-0000000007f1';
update public.profiles set username = 'pgtap_finn' where id = '00000000-0000-7000-8000-0000000007f2';
update public.profiles set username = 'pgtap_flo' where id = '00000000-0000-7000-8000-0000000007f3';
update public.profiles set username = 'pgtap_fox', visibility = 'private' where id = '00000000-0000-7000-8000-0000000007f4';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000007a1', 'movie', 'tmdb', '990000071', 'Pgtap Finish Line'),
  ('10000000-0000-4000-8000-0000000007a2', 'movie', 'tmdb', '990000072', 'Pgtap Quiet One');

-- The first finisher of a title is #1, the next #2.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007f1", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000007e1', '00000000-0000-7000-8000-0000000007f1', '10000000-0000-4000-8000-0000000007a1', 'finished', now());
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e1'), 1, 'the first finisher is #1');

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007f2", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000007e2', '00000000-0000-7000-8000-0000000007f2', '10000000-0000-4000-8000-0000000007a1', 'finished', now());
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e2'), 2, 'the next finisher is #2');

-- Clients can't choose or change a number.
select throws_ok(
  $$ insert into public.entries (id, user_id, title_id, status, finished_at, finisher_no) values
       ('01926000-0000-7000-8000-0000000007e9', '00000000-0000-7000-8000-0000000007f2', '10000000-0000-4000-8000-0000000007a2', 'finished', now(), 1) $$,
  '42501', null, 'clients cannot set a finisher number'
);
select throws_ok(
  $$ update public.entries set finisher_no = 1 where id = '01926000-0000-7000-8000-0000000007e2' $$,
  '42501', null, 'clients cannot change a finisher number'
);

-- Deleting the entry and finishing again keeps #1.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007f1", "role": "authenticated"}';
update public.entries set deleted_at = now() where id = '01926000-0000-7000-8000-0000000007e1';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000007e3', '00000000-0000-7000-8000-0000000007f1', '10000000-0000-4000-8000-0000000007a1', 'finished', now());
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e3'), 1, 'finishing again after deleting keeps the number');

-- A title added as Watching has no number until it is finished; going back to Watching keeps it.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007f3", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000007e4', '00000000-0000-7000-8000-0000000007f3', '10000000-0000-4000-8000-0000000007a1', 'watching');
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e4'), null, 'no number while watching');
update public.entries set status = 'finished', finished_at = now() where id = '01926000-0000-7000-8000-0000000007e4';
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e4'), 3, 'finishing it hands out #3');
update public.entries set status = 'watching', finished_at = null where id = '01926000-0000-7000-8000-0000000007e4';
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e4'), 3, 'un-finishing keeps the number');
update public.entries set status = 'finished', finished_at = now() where id = '01926000-0000-7000-8000-0000000007e4';

-- The ledger: owners read their own numbers only; nobody writes it or the counts.
select results_eq(
  $$ select title_id, number from public.title_finishers $$,
  $$ values ('10000000-0000-4000-8000-0000000007a1'::uuid, 3) $$,
  'owners read only their own finisher numbers'
);
select throws_ok(
  $$ insert into public.title_finishers (title_id, user_id, number) values ('10000000-0000-4000-8000-0000000007a2', '00000000-0000-7000-8000-0000000007f3', 1) $$,
  '42501', null, 'clients cannot write the ledger'
);
select throws_ok(
  $$ update public.title_finish_counts set finishers = 0 $$,
  '42501', null, 'clients cannot change the counts'
);

-- The service role can't pick a number either: the trigger overwrites it.
reset role;
insert into public.entries (id, user_id, title_id, status, finished_at, finisher_no) values
  ('01926000-0000-7000-8000-0000000007e5', '00000000-0000-7000-8000-0000000007f4', '10000000-0000-4000-8000-0000000007a1', 'finished', now(), 99);
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e5'), 4, 'a number sent with the row is ignored');
select throws_ok(
  $$ insert into public.title_finishers (title_id, user_id, number) values ('10000000-0000-4000-8000-0000000007a1', '00000000-0000-7000-8000-0000000007f2', 4) $$,
  '23505', null, 'a number is given out once per title'
);
select is(
  (select array_agg(number order by number) from public.title_finishers where title_id = '10000000-0000-4000-8000-0000000007a1'),
  array[1, 2, 3, 4],
  'numbers have no gaps and no repeats'
);

-- Anyone reads the counts.
set local role anon;
select is((select finishers from public.title_finish_counts where title_id = '10000000-0000-4000-8000-0000000007a1'), 4, 'signed-out visitors read how many finished a title');
select throws_ok($$ select 1 from public.title_finishers $$, '42501', null, 'signed-out visitors cannot read the ledger');

-- Trending: 4 people finished the first title this week; the second has only 2 people and stays hidden.
reset role;
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000007e6', '00000000-0000-7000-8000-0000000007f1', '10000000-0000-4000-8000-0000000007a2', 'finished', now());
insert into public.episode_logs (id, user_id, title_id, season, episode, watched_at) values
  ('01926000-0000-7000-8000-0000000007d1', '00000000-0000-7000-8000-0000000007f2', '10000000-0000-4000-8000-0000000007a2', 1, 1, now());
set local role anon;
select results_eq(
  $$ select people, finishers from public.trending_titles(7, 50) where title_id = '10000000-0000-4000-8000-0000000007a1' $$,
  $$ values (4, 4) $$,
  'a title 4 people finished this week is trending (private profiles count, anonymously)'
);
select is_empty(
  $$ select 1 from public.trending_titles(7, 50) where title_id = '10000000-0000-4000-8000-0000000007a2' $$,
  'a title fewer than 3 people were on never shows'
);
select is(
  (select count(*)::int from public.trending_titles(7, 50) t where t.title_id = '10000000-0000-4000-8000-0000000007a1'),
  1,
  'each title is listed once'
);

-- Old and deleted activity doesn't count.
reset role;
update public.entries set finished_at = now() - interval '30 days'
where title_id = '10000000-0000-4000-8000-0000000007a1' and user_id in ('00000000-0000-7000-8000-0000000007f1', '00000000-0000-7000-8000-0000000007f2') and deleted_at is null;
select is_empty(
  $$ select 1 from public.trending_titles(7, 50) where title_id = '10000000-0000-4000-8000-0000000007a1' $$,
  'finishes older than the window drop out'
);
select results_eq(
  $$ select people from public.trending_titles(31, 50) where title_id = '10000000-0000-4000-8000-0000000007a1' $$,
  $$ values (4) $$,
  'a longer window brings them back'
);

-- The Following feed shows each finish's number.
insert into public.follows (id, follower_id, followee_id) values
  ('01926000-0000-7000-8000-0000000007c1', '00000000-0000-7000-8000-0000000007f2', '00000000-0000-7000-8000-0000000007f1');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007f2", "role": "authenticated"}';
select results_eq(
  $$ select finisher_no from public.following_feed(null, null, 50) where entry_id = '01926000-0000-7000-8000-0000000007e3' $$,
  $$ values (1) $$,
  'the feed carries the finisher number'
);

-- Deleting an account removes its numbers, but never frees them: the next finisher is #5.
reset role;
delete from auth.users where id = '00000000-0000-7000-8000-0000000007f4';
select is_empty($$ select 1 from public.title_finishers where user_id = '00000000-0000-7000-8000-0000000007f4' $$, 'account deletion removes the numbers');
insert into auth.users (id, email) values ('00000000-0000-7000-8000-0000000007f5', 'f5@example.com');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000007e7', '00000000-0000-7000-8000-0000000007f5', '10000000-0000-4000-8000-0000000007a1', 'finished', now());
select is((select finisher_no from public.entries where id = '01926000-0000-7000-8000-0000000007e7'), 5, 'numbers are never reused');

select * from finish();
rollback;
