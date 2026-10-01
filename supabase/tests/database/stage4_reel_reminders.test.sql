-- pgTAP tests for Reel of the Day reminders (ADR 0054): only players who turned them on, whose streak of 2 or more
-- the day's reel would end, who have a device and weren't reminded that day. Run with `pnpm db:test`.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000008a1', 'remind1@example.com'),
  ('00000000-0000-7000-8000-0000000008a2', 'remind2@example.com'),
  ('00000000-0000-7000-8000-0000000008a3', 'remind3@example.com'),
  ('00000000-0000-7000-8000-0000000008a4', 'remind4@example.com');
update public.profiles set reel_reminders = true, locale = 'th', time_zone = 'Asia/Bangkok' where id = '00000000-0000-7000-8000-0000000008a1';
-- a2: streak of 1 only; a3: reminders off; a4: no device.
update public.profiles set reel_reminders = true where id in ('00000000-0000-7000-8000-0000000008a2', '00000000-0000-7000-8000-0000000008a4');

select is((select reel_reminders from public.profiles where id = '00000000-0000-7000-8000-0000000008a3'), false, 'reminders are off by default');

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000008a1', 'movie', 'tmdb', '990000801', 'Reminder Film');
insert into public.daily_reels (day, number, title_id) values ('2030-01-01', 9001, '10000000-0000-4000-8000-0000000008a1')
  on conflict do nothing;
insert into public.reel_plays (id, user_id, day, guesses, solved, finished_at, streak) values
  ('01926000-0000-7000-8000-0000000008b1', '00000000-0000-7000-8000-0000000008a1', '2030-01-01', '[]', true, now(), 5),
  ('01926000-0000-7000-8000-0000000008b2', '00000000-0000-7000-8000-0000000008a2', '2030-01-01', '[]', true, now(), 1),
  ('01926000-0000-7000-8000-0000000008b3', '00000000-0000-7000-8000-0000000008a3', '2030-01-01', '[]', true, now(), 3),
  ('01926000-0000-7000-8000-0000000008b4', '00000000-0000-7000-8000-0000000008a4', '2030-01-01', '[]', true, now(), 3);
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
  ('01926000-0000-7000-8000-0000000008c1', '00000000-0000-7000-8000-0000000008a1', 'https://fcm.googleapis.com/fcm/send/pgtap-remind1', repeat('A', 87), repeat('B', 22)),
  ('01926000-0000-7000-8000-0000000008c2', '00000000-0000-7000-8000-0000000008a2', 'https://fcm.googleapis.com/fcm/send/pgtap-remind2', repeat('A', 87), repeat('B', 22)),
  ('01926000-0000-7000-8000-0000000008c3', '00000000-0000-7000-8000-0000000008a3', 'https://fcm.googleapis.com/fcm/send/pgtap-remind3', repeat('A', 87), repeat('B', 22));

select results_eq(
  $$ select user_id, locale, time_zone, streak, subscription_id from public.reel_reminders_due('2030-01-02', 100)
     where user_id::text like '00000000-0000-7000-8000-0000000008a%' $$,
  $$ values ('00000000-0000-7000-8000-0000000008a1'::uuid, 'th', 'Asia/Bangkok', 5, '01926000-0000-7000-8000-0000000008c1'::uuid) $$,
  'only a streak of 2 or more, with reminders on and a device'
);
select is_empty(
  $$ select * from public.reel_reminders_due('2030-01-03', 100) where user_id::text like '00000000-0000-7000-8000-0000000008a%' $$,
  'no streak to keep without a win the day before'
);

-- Started today's reel but not finished: still reminded. Finished: not.
insert into public.daily_reels (day, number, title_id) values ('2030-01-02', 9002, '10000000-0000-4000-8000-0000000008a1')
  on conflict do nothing;
insert into public.reel_plays (id, user_id, day, guesses) values
  ('01926000-0000-7000-8000-0000000008b5', '00000000-0000-7000-8000-0000000008a1', '2030-01-02', '[{"externalId": "1", "name": "Wrong"}]');
select is(
  (select count(*)::int from public.reel_reminders_due('2030-01-02', 100) where user_id = '00000000-0000-7000-8000-0000000008a1'), 1,
  'a play in progress still gets a reminder'
);
update public.reel_plays set solved = true, finished_at = now(), streak = 6 where id = '01926000-0000-7000-8000-0000000008b5';
select is_empty(
  $$ select * from public.reel_reminders_due('2030-01-02', 100) where user_id = '00000000-0000-7000-8000-0000000008a1' $$,
  'a finished play needs no reminder'
);
update public.reel_plays set solved = false, finished_at = null, streak = null where id = '01926000-0000-7000-8000-0000000008b5';

update public.profiles set reel_reminded_on = '2030-01-02' where id = '00000000-0000-7000-8000-0000000008a1';
select is_empty(
  $$ select * from public.reel_reminders_due('2030-01-02', 100) where user_id = '00000000-0000-7000-8000-0000000008a1' $$,
  'one reminder a day'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008a3", "role": "authenticated"}';
select lives_ok(
  $$ update public.profiles set reel_reminders = true where id = '00000000-0000-7000-8000-0000000008a3' $$,
  'players turn reminders on themselves'
);
select is((select reel_reminders from public.profiles where id = '00000000-0000-7000-8000-0000000008a3'), true, 'and it is saved');
select throws_ok(
  $$ update public.profiles set reel_reminded_on = null where id = '00000000-0000-7000-8000-0000000008a3' $$,
  '42501', null, 'only the server records reminders'
);
select throws_ok($$ select * from public.reel_reminders_due('2030-01-02', 10) $$, '42501', null, 'users cannot list reminders');

select * from finish();
rollback;
