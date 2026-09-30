-- pgTAP tests for badges (S3 badges & shelf, ADR 0038): only the server awards them, once per badge, and they are
-- read like the rest of a collection (public profiles, not across a block). Run with `pnpm db:test`.
begin;
select plan(16);

-- b1 and b2 are public, b3 is private.
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000006b1', 'b1@example.com'),
  ('00000000-0000-7000-8000-0000000006b2', 'b2@example.com'),
  ('00000000-0000-7000-8000-0000000006b3', 'b3@example.com');
update public.profiles set username = 'pgtap_bea' where id = '00000000-0000-7000-8000-0000000006b1';
update public.profiles set username = 'pgtap_bo' where id = '00000000-0000-7000-8000-0000000006b2';
update public.profiles set username = 'pgtap_bix', visibility = 'private' where id = '00000000-0000-7000-8000-0000000006b3';

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000006b1', 'book', 'google_books', 'pgtap-badge-1', 'Bea Book');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000006e1', '00000000-0000-7000-8000-0000000006b1', '10000000-0000-4000-8000-0000000006b1', 'finished', '2026-09-01T10:00Z');

-- The server (service role) awards.
set local role service_role;
select lives_ok(
  $$ insert into public.user_badges (id, user_id, badge, earned_at, title_id) values
       ('01926000-0000-7000-8000-0000000006c1', '00000000-0000-7000-8000-0000000006b1', 'first-book', '2026-09-01T10:00Z', '10000000-0000-4000-8000-0000000006b1'),
       ('01926000-0000-7000-8000-0000000006c3', '00000000-0000-7000-8000-0000000006b3', 'first-movie', '2026-09-02T10:00Z', null) $$,
  'the service role awards badges'
);
select throws_ok(
  $$ insert into public.user_badges (id, user_id, badge, earned_at) values
       ('01926000-0000-7000-8000-0000000006c2', '00000000-0000-7000-8000-0000000006b1', 'first-book', now()) $$,
  '23505', null, 'a badge is awarded once per person'
);
with x as (
  insert into public.user_badges (id, user_id, badge, earned_at) values
    ('01926000-0000-7000-8000-0000000006c4', '00000000-0000-7000-8000-0000000006b1', 'first-book', now())
  on conflict (user_id, badge) do nothing
  returning 1
)
select is((select count(*)::int from x), 0, 'a second award of the same badge is skipped (what POST /api/milestones relies on)');
select throws_ok(
  $$ insert into public.user_badges (id, user_id, badge, earned_at) values
       ('01926000-0000-7000-8000-0000000006c5', '00000000-0000-7000-8000-0000000006b1', 'Not A Slug!', now()) $$,
  '23514', null, 'badge slugs are checked'
);
select throws_ok(
  $$ insert into public.user_badges (id, user_id, badge, earned_at) values
       ('01926000-0000-4000-8000-0000000006c6', '00000000-0000-7000-8000-0000000006b1', 'bookworm', now()) $$,
  '23514', null, 'badge ids are UUID v7'
);

-- Clients can't give themselves badges, change or remove them.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000006b1", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.user_badges (id, user_id, badge, earned_at) values
       ('01926000-0000-7000-8000-0000000006c7', '00000000-0000-7000-8000-0000000006b1', 'bookworm', now()) $$,
  '42501', null, 'users cannot award themselves a badge'
);
select throws_ok($$ update public.user_badges set badge = 'bookworm' $$, '42501', null, 'users cannot change a badge');
select throws_ok($$ delete from public.user_badges $$, '42501', null, 'users cannot remove a badge');
select results_eq($$ select badge from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, $$ values ('first-book') $$, 'owners read their badges');

-- Deleting the finish behind a badge keeps the badge.
update public.entries set deleted_at = now() where id = '01926000-0000-7000-8000-0000000006e1';
select results_eq($$ select badge from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, $$ values ('first-book') $$, 'badges stay after their finish is deleted');

-- Others: a public profile's badges are readable, a private one's aren't.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000006b2", "role": "authenticated"}';
select results_eq($$ select badge from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, $$ values ('first-book') $$, 'badges of a public profile are readable');
select is_empty($$ select 1 from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b3' $$, 'badges of a private profile are hidden');

set local role anon;
select results_eq($$ select badge from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, $$ values ('first-book') $$, 'signed-out visitors read public badges');
select is_empty($$ select 1 from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b3' $$, 'signed-out visitors never see private badges');

-- A block hides them both ways.
reset role;
insert into public.blocks (id, blocker_id, blocked_id) values
  ('01926000-0000-7000-8000-0000000006d1', '00000000-0000-7000-8000-0000000006b1', '00000000-0000-7000-8000-0000000006b2');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000006b2", "role": "authenticated"}';
select is_empty($$ select 1 from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, 'the blocked person cannot read the blocker''s badges');

-- Deleting the account removes its badges.
reset role;
delete from auth.users where id = '00000000-0000-7000-8000-0000000006b1';
select is_empty($$ select 1 from public.user_badges where user_id = '00000000-0000-7000-8000-0000000006b1' $$, 'account deletion removes badges');

select * from finish();
rollback;
