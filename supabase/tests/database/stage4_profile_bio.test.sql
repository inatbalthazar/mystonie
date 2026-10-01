-- pgTAP tests for the profile bio (ADR 0057): set by its owner only, checked for length, lines and control
-- characters, and shown to others only while the profile is public. Run with `pnpm db:test`.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000ab1', 'bio1@example.com'),
  ('00000000-0000-7000-8000-000000000ab2', 'bio2@example.com');
update public.profiles set username = 'bio_one' where id = '00000000-0000-7000-8000-000000000ab1';
update public.profiles set username = 'bio_two' where id = '00000000-0000-7000-8000-000000000ab2';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ab1", "role": "authenticated"}';
select lives_ok(
  $$ update public.profiles set bio = E'Ghibli forever 🌿\nSlowly finishing One Piece' where id = '00000000-0000-7000-8000-000000000ab1' $$,
  'the owner sets a two-line bio'
);
select throws_ok(
  $$ update public.profiles set bio = repeat('a', 161) where id = '00000000-0000-7000-8000-000000000ab1' $$,
  '23514', null, 'at most 160 characters'
);
select throws_ok(
  $$ update public.profiles set bio = E'a\nb\nc\nd\ne' where id = '00000000-0000-7000-8000-000000000ab1' $$,
  '23514', null, 'at most 4 lines'
);
select throws_ok(
  $$ update public.profiles set bio = E'tab\there' where id = '00000000-0000-7000-8000-000000000ab1' $$,
  '23514', null, 'no control characters but line breaks'
);
select throws_ok(
  $$ update public.profiles set bio = '' where id = '00000000-0000-7000-8000-000000000ab1' $$,
  '23514', null, 'empty is null, not an empty string'
);
update public.profiles set bio = 'Not mine' where id = '00000000-0000-7000-8000-000000000ab2';
reset role;
select is((select bio from public.profiles where id = '00000000-0000-7000-8000-000000000ab2'), null, 'nobody sets another person''s bio');

-- Another viewer sees it while the profile is public, not once it's private.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ab2", "role": "authenticated"}';
select is((select bio from public.public_profile('bio_one')), E'Ghibli forever 🌿\nSlowly finishing One Piece', 'visitors see a public profile''s bio');
reset role;
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-000000000ab1';
set local role authenticated;
select is((select bio from public.public_profile('bio_one')), null, 'a private profile hides its bio');
set local role anon;
select is((select bio from public.public_profile('bio_two')), null, 'no bio is null');

select * from finish();
rollback;
