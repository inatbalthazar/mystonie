-- pgTAP tests for social (S3 social, ADR 0037): follows, Stamps, blocks, the feed and finding people.
-- Run with `pnpm db:test`.
begin;
select plan(34);

-- Without Stonie (ADR 0098, tested in stage4_lively_album.test.sql), whose welcome follows and milestone Stamps would
-- be in every count here. The rollback brings it back.
delete from auth.users where id = '5707e000-0000-4000-8000-000000000001';

-- s1 and s2 are public, s3 is private.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000005a1', 's1@example.com'),
  ('00000000-0000-7000-8000-0000000005a2', 's2@example.com'),
  ('00000000-0000-7000-8000-0000000005a3', 's3@example.com');
update public.profiles set username = 'pgtap_sam', display_name = 'Sam Social' where id = '00000000-0000-7000-8000-0000000005a1';
update public.profiles set username = 'pgtap_kim', display_name = 'Kim Qwpfriend' where id = '00000000-0000-7000-8000-0000000005a2';
update public.profiles set username = 'pgtap_lee', visibility = 'private' where id = '00000000-0000-7000-8000-0000000005a3';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000005a1', 'movie', 'tmdb', 'pgtap-social-1', 'Sam Movie'),
  ('10000000-0000-4000-8000-0000000005a2', 'movie', 'tmdb', 'pgtap-social-2', 'Kim Movie'),
  ('10000000-0000-4000-8000-0000000005a3', 'movie', 'tmdb', 'pgtap-social-3', 'Lee Movie'),
  ('10000000-0000-4000-8000-0000000005a4', 'series', 'tmdb', 'pgtap-social-4', 'Kim Series');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000005e1', '00000000-0000-7000-8000-0000000005a1', '10000000-0000-4000-8000-0000000005a1', 'finished', '2026-09-01T10:00Z'),
  ('01926000-0000-7000-8000-0000000005e2', '00000000-0000-7000-8000-0000000005a2', '10000000-0000-4000-8000-0000000005a2', 'finished', '2026-09-02T10:00Z'),
  ('01926000-0000-7000-8000-0000000005e3', '00000000-0000-7000-8000-0000000005a3', '10000000-0000-4000-8000-0000000005a3', 'finished', '2026-09-03T10:00Z'),
  ('01926000-0000-7000-8000-0000000005e4', '00000000-0000-7000-8000-0000000005a2', '10000000-0000-4000-8000-0000000005a4', 'watching', null);

set local role anon;
select throws_ok($$ select * from public.following_feed() $$, '42501', null, 'signed-out visitors have no feed');
select throws_ok(
  $$ insert into public.follows (id, follower_id, followee_id)
     values ('01926000-0000-7000-8000-0000000005f0', '00000000-0000-7000-8000-0000000005a1', '00000000-0000-7000-8000-0000000005a2') $$,
  '42501', null, 'signed-out visitors cannot follow'
);

-- Sam follows Kim.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000005a1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-7000-8000-0000000005f1', '00000000-0000-7000-8000-0000000005a2') $$,
  'users follow a public profile'
);
select throws_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-7000-8000-0000000005f2', '00000000-0000-7000-8000-0000000005a2') $$,
  '23505', null, 'a follow is live once per pair'
);
select throws_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-7000-8000-0000000005f3', '00000000-0000-7000-8000-0000000005a3') $$,
  '42501', null, 'private profiles cannot be followed'
);
select throws_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-7000-8000-0000000005f4', '00000000-0000-7000-8000-0000000005a1') $$,
  '23514', null, 'nobody follows themselves'
);
select throws_ok(
  $$ insert into public.follows (id, follower_id, followee_id)
     values ('01926000-0000-7000-8000-0000000005f5', '00000000-0000-7000-8000-0000000005a3', '00000000-0000-7000-8000-0000000005a2') $$,
  '42501', null, 'nobody follows on someone else''s behalf'
);
select throws_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-4000-8000-0000000005f6', '00000000-0000-7000-8000-0000000005a2') $$,
  '23514', null, 'follow ids are UUID v7'
);
select throws_ok($$ delete from public.follows $$, '42501', null, 'no hard delete of follows');
select throws_ok(
  $$ update public.follows set followee_id = '00000000-0000-7000-8000-0000000005a3' $$,
  '42501', null, 'only deleted_at of a follow can change'
);

-- The feed: Sam's own finish and Kim's, newest first. Lee (private, not followed) never appears.
select results_eq(
  $$ select title_name, username from public.following_feed() $$,
  $$ values ('Kim Movie', 'pgtap_kim'), ('Sam Movie', 'pgtap_sam') $$,
  'the feed has my finishes and those of people I follow, newest first'
);
select results_eq(
  $$ select title_name from public.following_feed('2026-09-02T10:00Z', '01926000-0000-7000-8000-0000000005e2') $$,
  $$ values ('Sam Movie') $$,
  'the feed pages by (finished_at, entry id)'
);

-- Stamps.
select lives_ok(
  $$ insert into public.stamps (id, entry_id) values ('01926000-0000-7000-8000-0000000005d1', '01926000-0000-7000-8000-0000000005e2') $$,
  'users stamp a finish of someone they can see'
);
select results_eq(
  $$ select owner_id::text from public.stamps where id = '01926000-0000-7000-8000-0000000005d1' $$,
  $$ values ('00000000-0000-7000-8000-0000000005a2') $$,
  'the stamp''s owner is copied from the entry'
);
select throws_ok(
  $$ insert into public.stamps (id, entry_id) values ('01926000-0000-7000-8000-0000000005d2', '01926000-0000-7000-8000-0000000005e2') $$,
  '23505', null, 'one live stamp per finish'
);
select throws_ok(
  $$ insert into public.stamps (id, entry_id) values ('01926000-0000-7000-8000-0000000005d3', '01926000-0000-7000-8000-0000000005e1') $$,
  '42501', null, 'nobody stamps their own finish'
);
select throws_ok(
  $$ insert into public.stamps (id, entry_id) values ('01926000-0000-7000-8000-0000000005d4', '01926000-0000-7000-8000-0000000005e4') $$,
  '42501', null, 'only finishes can be stamped'
);
select throws_ok(
  $$ insert into public.stamps (id, entry_id) values ('01926000-0000-7000-8000-0000000005d5', '01926000-0000-7000-8000-0000000005e3') $$,
  '42501', null, 'finishes of private profiles cannot be stamped'
);
select results_eq(
  $$ select stamp_count, stamped from public.following_feed() where title_name = 'Kim Movie' $$,
  $$ values (1, true) $$,
  'the feed counts stamps and knows mine'
);
select results_eq(
  $$ select followers, following, i_follow from public.follow_counts('00000000-0000-7000-8000-0000000005a2') $$,
  $$ values (1, 0, true) $$,
  'follow counts of a public profile'
);
select is_empty(
  $$ select * from public.follow_counts('00000000-0000-7000-8000-0000000005a3') $$,
  'no follow counts for a private profile'
);
select results_eq(
  $$ select username, finished, i_follow from public.search_people('pgtap_') $$,
  $$ values ('pgtap_kim', 1, true) $$,
  'find people: public profiles only, never myself'
);
select results_eq(
  $$ select username from public.search_people('qwpfriend') $$,
  $$ values ('pgtap_kim') $$,
  'find people by display name'
);
select is_empty($$ select * from public.search_people('pgtap%') $$, 'wildcards are matched literally');

-- Kim sees the stamp and the new follower.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000005a2", "role": "authenticated"}';
select results_eq(
  $$ select kind, username, title_name, i_follow from public.my_activity() order by kind $$,
  $$ values ('follow', 'pgtap_sam', null::text, false), ('stamp', 'pgtap_sam', 'Kim Movie', false) $$,
  'activity: stamps on my finishes and new followers'
);

-- Going private takes Kim out of Sam's feed.
reset role;
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-0000000005a2';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000005a1", "role": "authenticated"}';
select results_eq(
  $$ select title_name from public.following_feed() $$,
  $$ values ('Sam Movie') $$,
  'a private profile''s finishes never appear in a feed'
);
reset role;
update public.profiles set visibility = 'public' where id = '00000000-0000-7000-8000-0000000005a2';

-- Kim blocks Sam.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000005a2", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.blocks (id, blocked_id) values ('01926000-0000-7000-8000-0000000005b1', '00000000-0000-7000-8000-0000000005a1') $$,
  'users block someone'
);
select results_eq(
  $$ select blocked_by_me, id is not null, is_private from public.public_profile('pgtap_sam') $$,
  $$ values (true, true, true) $$,
  'the blocker sees the blocked profile as blocked (with the id, to unblock)'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000005a1", "role": "authenticated"}';
select results_eq(
  $$ select (select count(*)::int from public.follows where deleted_at is null), (select count(*)::int from public.stamps where deleted_at is null) $$,
  $$ values (0, 0) $$,
  'a block removes follows and stamps between the two'
);
select results_eq(
  $$ select is_private, id is null, blocked_by_me from public.public_profile('pgtap_kim') $$,
  $$ values (true, true, false) $$,
  'the blocked user sees the blocker''s profile as private'
);
select is_empty(
  $$ select 1 from public.entries where user_id = '00000000-0000-7000-8000-0000000005a2' $$,
  'the blocked user cannot read the blocker''s entries'
);
select throws_ok(
  $$ insert into public.follows (id, followee_id) values ('01926000-0000-7000-8000-0000000005f7', '00000000-0000-7000-8000-0000000005a2') $$,
  '42501', null, 'the blocked user cannot follow the blocker again'
);
select is_empty($$ select * from public.blocks $$, 'nobody sees that they were blocked');
select is_empty($$ select * from public.search_people('pgtap_kim') $$, 'blocked people are not found');

select * from finish();
rollback;
