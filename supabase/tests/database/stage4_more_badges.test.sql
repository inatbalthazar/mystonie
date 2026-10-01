-- pgTAP tests for the Supporter sticker from tips (ADR 0063): award_supporter() is for the service role only, finds
-- the account by its sign-in email (any case), awards once and keeps the first date. Run with `pnpm db:test`.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000ab1', 'tipper@example.com');

select is(public.award_supporter('Tipper@Example.com ', '2026-10-01T10:00:00Z'), true, 'a tip finds the account by its email, in any case');
select is(public.award_supporter('nobody@example.com', '2026-10-01T10:00:00Z'), false, 'an email with no account changes nothing');
select is(public.award_supporter('tipper@example.com', '2026-10-05T10:00:00Z'), true, 'a second tip matches too');
select results_eq(
  $$ select badge, earned_at from public.user_badges where user_id = '00000000-0000-7000-8000-000000000ab1' $$,
  $$ values ('supporter', '2026-10-01T10:00:00Z'::timestamptz) $$,
  'the sticker is awarded once, dated by the first tip'
);
select is(public.award_supporter('tipper@example.com', now() + interval '1 day') is not null, true, 'a date ahead is accepted');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ab1", "role": "authenticated"}';
select throws_ok($$ select public.award_supporter('tipper@example.com', now()) $$, '42501', null, 'signed-in people cannot award themselves');
reset role;

set local role anon;
select throws_ok($$ select public.award_supporter('tipper@example.com', now()) $$, '42501', null, 'visitors cannot either');
reset role;

select * from finish();
rollback;
