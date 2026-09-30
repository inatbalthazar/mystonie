-- pgTAP tests for content warnings (S2 content warnings, ADR 0035). Run with `pnpm db:test`.
begin;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000f1', 'f1@example.com'),
  ('00000000-0000-7000-8000-0000000000f2', 'f2@example.com');
insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000000f1', 'movie', 'tmdb', 'pgtap-warn-movie', 'A Movie'),
  ('10000000-0000-4000-8000-0000000000f2', 'movie', 'tmdb', 'pgtap-warn-other', 'Another Movie');
update public.titles set dtdd_id = 15713, dtdd_checked_at = now() where id = '10000000-0000-4000-8000-0000000000f1';
insert into public.title_warnings (title_id, topic_id, topic_name, category, yes_count, no_count) values
  ('10000000-0000-4000-8000-0000000000f1', 153, 'a dog dies', 'Animal Death', 142, 3),
  ('10000000-0000-4000-8000-0000000000f1', 186, 'a cat dies', 'Animal Death', 2, 40),
  ('10000000-0000-4000-8000-0000000000f1', 165, 'there are spiders', 'Animal Phobia', 9, 1),
  ('10000000-0000-4000-8000-0000000000f2', 153, 'a dog dies', 'Animal Death', 0, 12);

select throws_ok(
  $$ insert into public.title_warnings (title_id, topic_id, topic_name, category, yes_count, no_count)
     values ('10000000-0000-4000-8000-0000000000f2', 1, 'x', 'y', -1, 0) $$,
  '23514', null, 'vote counts are never negative'
);

set local role anon;
select results_eq(
  $$ select count(*)::int from public.title_warnings where title_id = '10000000-0000-4000-8000-0000000000f1' $$,
  $$ values (3) $$,
  'anyone can read cached warnings'
);
select throws_ok(
  $$ select * from public.avoid_warnings(array['10000000-0000-4000-8000-0000000000f1'::uuid]) $$,
  '42501', null, 'signed-out visitors have no badges'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000f1", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.user_avoid_topics (id, topic_id) values
       ('01926000-0000-7000-8000-00000000a153', 153),
       ('01926000-0000-7000-8000-00000000a186', 186),
       ('01926000-0000-7000-8000-00000000a165', 165) $$,
  'users pick topics to avoid'
);
select throws_ok(
  $$ insert into public.user_avoid_topics (id, topic_id) values ('01926000-0000-4000-8000-00000000a001', 161) $$,
  '23514', null, 'ids are UUID v7'
);
select throws_ok(
  $$ insert into public.user_avoid_topics (id, topic_id) values ('01926000-0000-7000-8000-00000000a002', 153) $$,
  '23505', null, 'a topic is chosen once while it is live'
);
select throws_ok(
  $$ insert into public.user_avoid_topics (id, user_id, topic_id)
     values ('01926000-0000-7000-8000-00000000a003', '00000000-0000-7000-8000-0000000000f2', 153) $$,
  '42501', null, 'nobody picks topics for someone else'
);
select throws_ok(
  $$ delete from public.user_avoid_topics where topic_id = 186 $$,
  '42501', null, 'no hard delete: unticking is a soft delete'
);
select throws_ok(
  $$ update public.user_avoid_topics set topic_id = 161 where topic_id = 186 $$,
  '42501', null, 'only deleted_at can change'
);
select lives_ok(
  $$ update public.user_avoid_topics set deleted_at = now() where topic_id = 165 $$,
  'users untick a topic'
);
select throws_ok(
  $$ insert into public.title_warnings (title_id, topic_id, topic_name, category, yes_count, no_count)
     values ('10000000-0000-4000-8000-0000000000f2', 2, 'x', 'y', 1, 0) $$,
  '42501', null, 'users cannot write warning data'
);
select results_eq(
  $$ select title_id::text, topic_id from public.avoid_warnings(array[
       '10000000-0000-4000-8000-0000000000f1'::uuid, '10000000-0000-4000-8000-0000000000f2'::uuid]) $$,
  $$ values ('10000000-0000-4000-8000-0000000000f1', 153) $$,
  'badges: only live avoided topics leaning yes, on the given titles'
);
select results_eq(
  $$ select count(*)::int from public.user_avoid_topics where deleted_at is not null $$,
  $$ values (1) $$,
  'owners still read their unticked topics (tombstones for sync)'
);

set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000f2", "role": "authenticated"}';
select is_empty(
  $$ select * from public.user_avoid_topics $$,
  'avoid topics are private'
);
select is_empty(
  $$ select * from public.avoid_warnings(array['10000000-0000-4000-8000-0000000000f1'::uuid]) $$,
  'another user''s topics give no badges'
);

reset role;
select throws_ok(
  $$ insert into public.user_avoid_topics (id, user_id, topic_id)
     select ('01926000-0000-7000-8000-' || lpad(to_hex(g), 12, '0'))::uuid, '00000000-0000-7000-8000-0000000000f2', g
     from generate_series(1, 501) g $$,
  '23514', null, 'a user avoids at most 500 live topics'
);
delete from public.titles where id = '10000000-0000-4000-8000-0000000000f1';
select is_empty(
  $$ select * from public.title_warnings where title_id = '10000000-0000-4000-8000-0000000000f1' $$,
  'warnings go with their title'
);

select * from finish();
rollback;
