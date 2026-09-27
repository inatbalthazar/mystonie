-- pgTAP tests for push subscriptions and recap pushes (ADR 0028). Run with `pnpm db:test`.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000b7', 'b7@example.com'),
  ('00000000-0000-7000-8000-0000000000b8', 'b8@example.com');
update public.profiles set locale = 'th' where id = '00000000-0000-7000-8000-0000000000b7';

-- p1 has two devices, p2 none.
insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) values
  ('01926000-0000-7000-8000-0000000002a1', '00000000-0000-7000-8000-0000000000b7', 'https://fcm.googleapis.com/fcm/send/pgtap-a',
   repeat('A', 87), repeat('B', 22), now() - interval '1 hour'),
  ('01926000-0000-7000-8000-0000000002a2', '00000000-0000-7000-8000-0000000000b7', 'https://web.push.apple.com/pgtap-b',
   repeat('C', 87), repeat('D', 22), now());

select throws_ok(
  $$ insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
       ('01926000-0000-7000-8000-0000000002a3', '00000000-0000-7000-8000-0000000000b8', 'https://fcm.googleapis.com/fcm/send/pgtap-a',
        repeat('A', 87), repeat('B', 22)) $$,
  '23505', null, 'an endpoint belongs to one row'
);
select throws_ok(
  $$ insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
       ('01926000-0000-7000-8000-0000000002a4', '00000000-0000-7000-8000-0000000000b8', 'https://fcm.googleapis.com/x', 'short', repeat('B', 22)) $$,
  '23514', null, 'keys must be base64url of the right length'
);

insert into public.weekly_recaps (id, user_id, week_start, stats, created_at) values
  ('01926000-0000-7000-8000-0000000002b1', '00000000-0000-7000-8000-0000000000b7', '2026-09-21', '{"minutes": 45}', now()),
  ('01926000-0000-7000-8000-0000000002b2', '00000000-0000-7000-8000-0000000000b7', '2026-09-07', '{"minutes": 30}', now() - interval '3 days'),
  ('01926000-0000-7000-8000-0000000002b3', '00000000-0000-7000-8000-0000000000b8', '2026-09-21', '{"minutes": 60}', now());

select results_eq(
  $$ select id, locale, subscription_id, endpoint from public.weekly_recaps_to_push(100)
     where user_id::text like '00000000-0000-7000-8000-0000000000b%' $$,
  $$ values ('01926000-0000-7000-8000-0000000002b1'::uuid, 'th', '01926000-0000-7000-8000-0000000002a1'::uuid, 'https://fcm.googleapis.com/fcm/send/pgtap-a'),
            ('01926000-0000-7000-8000-0000000002b1'::uuid, 'th', '01926000-0000-7000-8000-0000000002a2'::uuid, 'https://web.push.apple.com/pgtap-b') $$,
  'a new recap goes to every device of users with a subscription; old recaps and users without one are skipped'
);

update public.weekly_recaps set pushed_at = now() where id = '01926000-0000-7000-8000-0000000002b1';
select is_empty(
  $$ select * from public.weekly_recaps_to_push(100) where user_id::text like '00000000-0000-7000-8000-0000000000b%' $$,
  'a recap is pushed once'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000b7", "role": "authenticated"}';
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'users cannot read subscriptions directly');
select throws_ok(
  $$ insert into public.push_subscriptions (id, user_id, endpoint, p256dh, auth) values
       ('01926000-0000-7000-8000-0000000002a5', '00000000-0000-7000-8000-0000000000b7', 'https://fcm.googleapis.com/y', repeat('A', 87), repeat('B', 22)) $$,
  '42501', null, 'users cannot write subscriptions directly'
);
select throws_ok($$ select * from public.weekly_recaps_to_push(10) $$, '42501', null, 'users cannot list pushes');
select throws_ok($$ update public.weekly_recaps set pushed_at = null $$, '42501', null, 'users cannot change recaps');

set local role anon;
select throws_ok($$ select * from public.push_subscriptions $$, '42501', null, 'anonymous visitors cannot read subscriptions');

reset role;
delete from auth.users where id = '00000000-0000-7000-8000-0000000000b7';
select is_empty(
  $$ select * from public.push_subscriptions where user_id = '00000000-0000-7000-8000-0000000000b7' $$,
  'subscriptions go with the account'
);

select * from finish();
rollback;
