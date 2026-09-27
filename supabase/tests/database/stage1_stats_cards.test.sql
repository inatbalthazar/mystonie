-- pgTAP tests for "Share stats" cards (ADR 0026). Run with `pnpm db:test` (local stack must be running).
begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-7000-8000-0000000000e1', 'e1@example.com');
insert into public.titles (id, source, kind, external_id, name) values
  ('10000000-0000-4000-8000-0000000000e1', 'tmdb', 'movie', 'stats-test-1', 'Stats Test');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000000e1', '00000000-0000-7000-8000-0000000000e1', '10000000-0000-4000-8000-0000000000e1', 'finished', now());

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000e1", "role": "authenticated"}';

select lives_ok($$insert into public.cards (id, kind, template_id, size, params) values
  ('01926000-0000-7000-8000-0000000000e2', 'stats', 'boldStats', 'story', '{"recap": {"period": "year"}}')$$,
  'owners save a stats card');
select is((select count(*) from public.cards where kind = 'stats')::int, 1, 'and read it back');
select throws_ok($$insert into public.cards (id, entry_id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000e3', '01926000-0000-7000-8000-0000000000e1', 'stats', 'boldStats', 'story')$$,
  '23514', null, 'a stats card has no entry');
select throws_ok($$insert into public.cards (id, kind, template_id, size) values
  ('01926000-0000-7000-8000-0000000000e4', 'monthly', 'boldStats', 'story')$$,
  '23514', null, 'unknown card kinds are rejected');

select * from finish();
rollback;
