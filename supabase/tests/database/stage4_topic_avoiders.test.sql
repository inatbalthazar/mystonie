-- pgTAP tests for how many people avoid a warning topic (ADR 0094): a total without the caller, nothing under 3, only
-- live choices, signed in only. Run with `pnpm db:test`.
begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000d0a', 'avoid_a@example.com'),
  ('00000000-0000-7000-8000-000000000d0b', 'avoid_b@example.com'),
  ('00000000-0000-7000-8000-000000000d0c', 'avoid_c@example.com'),
  ('00000000-0000-7000-8000-000000000d0d', 'avoid_d@example.com'),
  ('00000000-0000-7000-8000-000000000d0e', 'avoid_e@example.com');

-- Spiders (DTDD 165): a, b, c and d avoid them; e chose them once and took it back. Dog dies (153): b and c only.
delete from public.user_avoid_topics where topic_id in (153, 165);
insert into public.user_avoid_topics (id, user_id, topic_id, deleted_at) values
  ('01926000-0000-7000-8000-000000000d01', '00000000-0000-7000-8000-000000000d0a', 165, null),
  ('01926000-0000-7000-8000-000000000d02', '00000000-0000-7000-8000-000000000d0b', 165, null),
  ('01926000-0000-7000-8000-000000000d03', '00000000-0000-7000-8000-000000000d0c', 165, null),
  ('01926000-0000-7000-8000-000000000d04', '00000000-0000-7000-8000-000000000d0d', 165, null),
  ('01926000-0000-7000-8000-000000000d05', '00000000-0000-7000-8000-000000000d0e', 165, now()),
  ('01926000-0000-7000-8000-000000000d06', '00000000-0000-7000-8000-000000000d0b', 153, null),
  ('01926000-0000-7000-8000-000000000d07', '00000000-0000-7000-8000-000000000d0c', 153, null);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000d0e", "role": "authenticated"}';
select is(public.topic_avoiders('spiders'), 4, 'everyone who avoids it now, not a choice taken back');
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000d0a", "role": "authenticated"}';
select is(public.topic_avoiders('spiders'), 3, 'not counting the caller');
select is(public.topic_avoiders('dog-dies'), 0, 'under 3 shows as none');
select is(public.topic_avoiders('no-such-topic'), 0, 'an unknown topic has none');
reset role;

set local role anon;
select throws_ok($$ select public.topic_avoiders('spiders') $$, '42501', null, 'signed-out visitors get nothing');
reset role;

select * from finish();
rollback;
