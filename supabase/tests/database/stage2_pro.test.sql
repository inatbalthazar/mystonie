-- pgTAP tests for Mystonie Pro subscriptions (ADR 0034). Run with `pnpm db:test`.
begin;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000000f1', 'f1@example.com'),
  ('00000000-0000-7000-8000-0000000000f2', 'f2@example.com');
insert into public.subscriptions (stripe_subscription_id, user_id, stripe_customer_id, status, price_id, current_period_end, event_at) values
  ('sub_pgtap1', '00000000-0000-7000-8000-0000000000f1', 'cus_pgtap1', 'active', 'price_pgtap', now() + interval '30 days', now()),
  ('sub_pgtap2', '00000000-0000-7000-8000-0000000000f2', 'cus_pgtap2', 'active', 'price_pgtap', now() + interval '30 days', now());

select throws_ok(
  $$ insert into public.subscriptions (stripe_subscription_id, user_id, stripe_customer_id, status, event_at)
     values ('sub_x', '00000000-0000-7000-8000-0000000000f1', 'cus_x', 'lifetime', now()) $$,
  '23514', null, 'status is one of Stripe''s'
);
select throws_ok(
  $$ insert into public.subscriptions (stripe_subscription_id, user_id, stripe_customer_id, status, event_at)
     values ('not-a-sub', '00000000-0000-7000-8000-0000000000f1', 'cus_x', 'active', now()) $$,
  '23514', null, 'ids look like Stripe ids'
);

set local role anon;
select throws_ok($$ select count(*) from public.subscriptions $$, '42501', null, 'anonymous visitors cannot read subscriptions');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000f1", "role": "authenticated"}';
select results_eq(
  $$ select stripe_subscription_id from public.subscriptions $$,
  $$ values ('sub_pgtap1') $$,
  'a user sees only their own subscription'
);
select throws_ok(
  $$ insert into public.subscriptions (stripe_subscription_id, user_id, stripe_customer_id, status, event_at)
     values ('sub_free', '00000000-0000-7000-8000-0000000000f1', 'cus_free', 'active', now()) $$,
  '42501', null, 'users cannot grant themselves Pro'
);
select throws_ok(
  $$ update public.subscriptions set current_period_end = now() + interval '100 years' where stripe_subscription_id = 'sub_pgtap1' $$,
  '42501', null, 'users cannot extend their own subscription'
);
reset role;

delete from auth.users where id = '00000000-0000-7000-8000-0000000000f2';
select results_eq(
  $$ select count(*)::int from public.subscriptions where stripe_subscription_id = 'sub_pgtap2' $$,
  $$ values (0) $$,
  'subscriptions go with the account'
);
select has_index('public', 'subscriptions', 'subscriptions_user_id', 'subscriptions are found by user');

select * from finish();
rollback;
