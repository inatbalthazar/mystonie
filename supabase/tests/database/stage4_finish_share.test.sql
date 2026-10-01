-- pgTAP tests for rare finishes (ADR 0067): a first finish keeps the share of Mystonie's members who had finished
-- the title then, for good, and nobody can set it. Works on a database with other rows (shares are checked against
-- member_count()). Run with `pnpm db:test`.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000008f1', 'rs1@example.com'),
  ('00000000-0000-7000-8000-0000000008f2', 'rs2@example.com');
update public.profiles set username = 'pgtap_rare_one' where id = '00000000-0000-7000-8000-0000000008f1';
update public.profiles set username = 'pgtap_rare_two' where id = '00000000-0000-7000-8000-0000000008f2';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000008a1', 'movie', 'tmdb', '990000081', 'Pgtap Rare Find');

create temp table members_now as select public.member_count() as n;
grant select on members_now to authenticated, anon;

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008f1", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008e1', '00000000-0000-7000-8000-0000000008f1', '10000000-0000-4000-8000-0000000008a1', 'finished', now());
select is(
  (select finish_share from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  1::numeric / (select n from members_now),
  'the first finisher is 1 of every member'
);
select is(
  (select finish_members from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  (select n from members_now),
  'the entry keeps the member count its share came from'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008f2", "role": "authenticated"}';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008e2', '00000000-0000-7000-8000-0000000008f2', '10000000-0000-4000-8000-0000000008a1', 'finished', now());
select is(
  (select finish_share from public.entries where id = '01926000-0000-7000-8000-0000000008e2'),
  2::numeric / (select n from members_now),
  'the second finisher counts both'
);

-- Nobody chooses or changes a share.
select throws_ok(
  $$ update public.entries set finish_share = 0.5 where id = '01926000-0000-7000-8000-0000000008e2' $$,
  '42501', null, 'clients cannot change a share'
);
select throws_ok(
  $$ update public.entries set finish_members = 5 where id = '01926000-0000-7000-8000-0000000008e2' $$,
  '42501', null, 'clients cannot change the member count'
);

-- Deleting and finishing again keeps the first share (the second finisher has finished since).
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008f1", "role": "authenticated"}';
update public.entries set deleted_at = now() where id = '01926000-0000-7000-8000-0000000008e1';
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000008e3', '00000000-0000-7000-8000-0000000008f1', '10000000-0000-4000-8000-0000000008a1', 'finished', now());
select is(
  (select finish_share from public.entries where id = '01926000-0000-7000-8000-0000000008e3'),
  1::numeric / (select n from members_now),
  'finishing again keeps the share it had'
);
select is(
  (select share from public.title_finishers where title_id = '10000000-0000-4000-8000-0000000008a1' and user_id = '00000000-0000-7000-8000-0000000008f1'),
  1::numeric / (select n from members_now),
  'the ledger keeps it for good'
);

-- The feed carries the share in place of the number.
select is(
  (select finish_share from public.following_feed() where entry_id = '01926000-0000-7000-8000-0000000008e3'),
  1::numeric / (select n from members_now),
  'the Following feed returns the share'
);

-- The member count is open to anyone (a count, no one in it).
reset role;
set local role anon;
select is(public.member_count(), (select n from members_now), 'anyone can read how many members Mystonie has');

select * from finish();
rollback;
