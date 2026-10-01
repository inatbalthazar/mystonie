-- pgTAP tests for "What people said" on title pages (stage 4, ADR 0051): title_reviews.
-- Run with `pnpm db:test`.
begin;
select plan(7);

-- r1 (the viewer), r2 public, r3 private, r4 public and blocks the viewer, r5 public with no review.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000007b1', 'r1@example.com'),
  ('00000000-0000-7000-8000-0000000007b2', 'r2@example.com'),
  ('00000000-0000-7000-8000-0000000007b3', 'r3@example.com'),
  ('00000000-0000-7000-8000-0000000007b4', 'r4@example.com'),
  ('00000000-0000-7000-8000-0000000007b5', 'r5@example.com');
update public.profiles set username = 'pgtap_rev_me' where id = '00000000-0000-7000-8000-0000000007b1';
update public.profiles set username = 'pgtap_rev_pub' where id = '00000000-0000-7000-8000-0000000007b2';
update public.profiles set username = 'pgtap_rev_priv', visibility = 'private' where id = '00000000-0000-7000-8000-0000000007b3';
update public.profiles set username = 'pgtap_rev_blk' where id = '00000000-0000-7000-8000-0000000007b4';
update public.profiles set username = 'pgtap_rev_none' where id = '00000000-0000-7000-8000-0000000007b5';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000007b1', 'movie', 'tmdb', 'pgtap-reviews-1', 'Review Movie'),
  ('10000000-0000-4000-8000-0000000007b2', 'movie', 'tmdb', 'pgtap-reviews-2', 'Other Movie');
insert into public.entries (id, user_id, title_id, status, finished_at, rating, review) values
  ('01926000-0000-7000-8000-0000000007e1', '00000000-0000-7000-8000-0000000007b1', '10000000-0000-4000-8000-0000000007b1', 'finished', '2026-09-01T10:00Z', 4, 'Mine'),
  ('01926000-0000-7000-8000-0000000007e2', '00000000-0000-7000-8000-0000000007b2', '10000000-0000-4000-8000-0000000007b1', 'finished', '2026-09-03T10:00Z', 5, 'Loved it'),
  ('01926000-0000-7000-8000-0000000007e3', '00000000-0000-7000-8000-0000000007b3', '10000000-0000-4000-8000-0000000007b1', 'finished', '2026-09-04T10:00Z', 3, 'Private words'),
  ('01926000-0000-7000-8000-0000000007e4', '00000000-0000-7000-8000-0000000007b4', '10000000-0000-4000-8000-0000000007b1', 'finished', '2026-09-05T10:00Z', 2, 'Blocked words'),
  ('01926000-0000-7000-8000-0000000007e5', '00000000-0000-7000-8000-0000000007b5', '10000000-0000-4000-8000-0000000007b1', 'finished', '2026-09-06T10:00Z', 4, null),
  ('01926000-0000-7000-8000-0000000007e6', '00000000-0000-7000-8000-0000000007b2', '10000000-0000-4000-8000-0000000007b2', 'finished', '2026-09-02T10:00Z', 1, 'Another title');
-- A review still being watched doesn't count.
insert into public.entries (id, user_id, title_id, status, review) values
  ('01926000-0000-7000-8000-0000000007e7', '00000000-0000-7000-8000-0000000007b5', '10000000-0000-4000-8000-0000000007b2', 'watching', 'Halfway');

-- r4 blocks the viewer.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007b4", "role": "authenticated"}';
insert into public.blocks (id, blocked_id) values ('01926000-0000-7000-8000-0000000007f1', '00000000-0000-7000-8000-0000000007b1');

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007b1", "role": "authenticated"}';
select results_eq(
  $$ select username, review, rating from public.title_reviews('10000000-0000-4000-8000-0000000007b1') $$,
  $$ values ('pgtap_rev_pub'::text, 'Loved it'::text, 5::numeric), ('pgtap_rev_me', 'Mine', 4) $$,
  'reviews of this title by me and public, unblocked people, newest first; no private, blocked or empty ones'
);
select is(
  (select count(*)::int from public.title_reviews('10000000-0000-4000-8000-0000000007b2')),
  1,
  'only finished entries with a review count'
);
select is(
  (select count(*)::int from public.title_reviews('10000000-0000-4000-8000-0000000007b1', 1)),
  1,
  'the limit applies'
);

-- The private reviewer sees their own.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007b3", "role": "authenticated"}';
select ok(
  exists (select 1 from public.title_reviews('10000000-0000-4000-8000-0000000007b1') where username = 'pgtap_rev_priv'),
  'a private profile sees its own review'
);

-- A soft-deleted entry disappears.
reset role;
update public.entries set deleted_at = now() where id = '01926000-0000-7000-8000-0000000007e2';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000007b1", "role": "authenticated"}';
select results_eq(
  $$ select username from public.title_reviews('10000000-0000-4000-8000-0000000007b1') $$,
  $$ values ('pgtap_rev_me'::text) $$,
  'deleted entries leave the list'
);

-- Signed-out visitors can't call it (title pages are signed in).
reset role;
set local role anon;
select throws_ok($$ select * from public.title_reviews('10000000-0000-4000-8000-0000000007b1') $$, '42501', null, 'signed-out visitors cannot list reviews');
reset role;
select has_index('public', 'entries', 'entries_title_reviews', 'reviews are read through their own partial index');

select * from finish();
rollback;
