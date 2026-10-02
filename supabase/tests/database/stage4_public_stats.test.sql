-- pgTAP tests for a profile's Stats tab (ADR 0077): the parts hidden from visitors are set by their owner only, checked
-- against the known sections, and shown to others only while the profile is public. Run with `pnpm db:test`.
begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000ad1', 'pstats1@example.com'),
  ('00000000-0000-7000-8000-000000000ad2', 'pstats2@example.com');
update public.profiles set username = 'pstats_one' where id = '00000000-0000-7000-8000-000000000ad1';
update public.profiles set username = 'pstats_two' where id = '00000000-0000-7000-8000-000000000ad2';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ad1", "role": "authenticated"}';
select lives_ok(
  $$ update public.profiles set stats_hidden = array['activity', 'records'] where id = '00000000-0000-7000-8000-000000000ad1' $$,
  'the owner hides parts of their stats'
);
select throws_ok(
  $$ update public.profiles set stats_hidden = array['shelf'] where id = '00000000-0000-7000-8000-000000000ad1' $$,
  '23514', null, 'only known sections'
);
update public.profiles set stats_hidden = array['numbers'] where id = '00000000-0000-7000-8000-000000000ad2';
reset role;
select is((select stats_hidden from public.profiles where id = '00000000-0000-7000-8000-000000000ad2'), '{}'::text[], 'nobody hides another person''s stats');

-- Another viewer sees what's hidden while the profile is public, not once it's private.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ad2", "role": "authenticated"}';
select is((select stats_hidden from public.public_profile('pstats_one')), array['activity', 'records'], 'visitors get the hidden parts');
reset role;
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-000000000ad1';
set local role authenticated;
select is((select stats_hidden from public.public_profile('pstats_one')), null, 'a private profile hides it');
set local role anon;
select is((select stats_hidden from public.public_profile('pstats_two')), '{}'::text[], 'nothing hidden: empty');

select * from finish();
rollback;
