-- pgTAP tests for the album as its owner arranges it (ADR 0069): set by its owner only, checked against the known
-- sections and the 4 shelf favourites, and shown to others only while the profile is public. Run with `pnpm db:test`.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-000000000ac1', 'layout1@example.com'),
  ('00000000-0000-7000-8000-000000000ac2', 'layout2@example.com');
update public.profiles set username = 'layout_one' where id = '00000000-0000-7000-8000-000000000ac1';
update public.profiles set username = 'layout_two' where id = '00000000-0000-7000-8000-000000000ac2';

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ac1", "role": "authenticated"}';
select lives_ok(
  $$ update public.profiles
     set album_order = array['shelf', 'cards'], album_hidden = array['saved'],
         shelf_pins = array['00000000-0000-4000-8000-0000000000f1']::uuid[]
     where id = '00000000-0000-7000-8000-000000000ac1' $$,
  'the owner arranges their album'
);
select throws_ok(
  $$ update public.profiles set album_order = array['feed'] where id = '00000000-0000-7000-8000-000000000ac1' $$,
  '23514', null, 'only known sections'
);
select throws_ok(
  $$ update public.profiles set album_hidden = array['atlas'] where id = '00000000-0000-7000-8000-000000000ac1' $$,
  '23514', null, 'the Atlas hides with its own switch'
);
select throws_ok(
  $$ update public.profiles set shelf_pins = array(select gen_random_uuid() from generate_series(1, 11))
     where id = '00000000-0000-7000-8000-000000000ac1' $$,
  '23514', null, 'at most 10 favourites (ADR 0095)'
);
select throws_ok(
  $$ update public.profiles set shelf_pins = array[null]::uuid[] where id = '00000000-0000-7000-8000-000000000ac1' $$,
  '23514', null, 'no empty favourite'
);
update public.profiles set album_order = array['clubs'] where id = '00000000-0000-7000-8000-000000000ac2';
reset role;
select is((select album_order from public.profiles where id = '00000000-0000-7000-8000-000000000ac2'), '{}'::text[], 'nobody arranges another person''s album');

-- Another viewer sees the arrangement while the profile is public, not once it's private.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000ac2", "role": "authenticated"}';
select is((select album_order from public.public_profile('layout_one')), array['shelf', 'cards'], 'visitors get the order');
select is((select shelf_pins from public.public_profile('layout_one')), array['00000000-0000-4000-8000-0000000000f1']::uuid[], 'and the favourites');
reset role;
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-000000000ac1';
set local role authenticated;
select is((select album_hidden from public.public_profile('layout_one')), null, 'a private profile hides it');
set local role anon;
select is((select album_order from public.public_profile('layout_two')), '{}'::text[], 'not arranged: empty, the default order');

select * from finish();
rollback;
