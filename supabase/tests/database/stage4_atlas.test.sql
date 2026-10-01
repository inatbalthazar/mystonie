-- pgTAP tests for the Atlas (stage 4, ADR 0059): places, profiles.atlas_public and Atlas cards.
-- Run with `pnpm db:test`.
begin;
select plan(15);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000009a1', 'at1@example.com'),
  ('00000000-0000-7000-8000-0000000009a2', 'at2@example.com');

-- at1 adds three countries.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
insert into public.places (id, country, status, first_year) values
  ('01926000-0000-7000-8000-0000000009b1', 'JP', 'been', 2019),
  ('01926000-0000-7000-8000-0000000009b2', 'PT', 'lived', null),
  ('01926000-0000-7000-8000-0000000009b3', 'PE', 'want', null);
select is((select count(*)::int from public.places), 3, 'people read their own places');
select throws_ok(
  $$ insert into public.places (id, country, status) values ('01926000-0000-7000-8000-0000000009b4', 'JP', 'lived') $$,
  '23505', null, 'one live row per country'
);
select throws_ok(
  $$ insert into public.places (id, country, status) values ('01926000-0000-7000-8000-0000000009b5', 'jp', 'been') $$,
  '23514', null, 'only ISO alpha-2 codes'
);
select throws_ok(
  $$ insert into public.places (id, country, status) values ('01926000-0000-7000-8000-0000000009b6', 'FR', 'visited') $$,
  '23514', null, 'only been, lived and want'
);
select throws_ok(
  $$ insert into public.places (id, country, status, first_year) values ('01926000-0000-7000-8000-0000000009b7', 'FR', 'want', 2020) $$,
  '23514', null, 'a first-visit year only with a visit'
);
select throws_ok(
  $$ insert into public.places (id, user_id, country, status) values ('01926000-0000-7000-8000-0000000009b8', '00000000-0000-7000-8000-0000000009a2', 'FR', 'been') $$,
  '42501', null, 'nobody adds places for someone else'
);
select throws_ok(
  $$ update public.places set country = 'FR' where id = '01926000-0000-7000-8000-0000000009b1' $$,
  '42501', null, 'a place keeps its country'
);
select throws_ok(
  $$ delete from public.places where id = '01926000-0000-7000-8000-0000000009b1' $$,
  '42501', null, 'places are never deleted by people (soft delete)'
);

-- Changing a status, taking a country off and adding it back.
update public.places set status = 'been' where id = '01926000-0000-7000-8000-0000000009b3';
update public.places set deleted_at = now() where id = '01926000-0000-7000-8000-0000000009b3';
insert into public.places (id, country, status) values ('01926000-0000-7000-8000-0000000009b9', 'PE', 'want');
select is(
  (select status from public.places where country = 'PE' and deleted_at is null),
  'want',
  'a country taken off can be added again'
);

-- at2 can't see at1's Atlas: private until the profile is public and the Atlas shown.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.places), 0, 'a private profile''s places are hidden');

reset role;
update public.profiles set visibility = 'public' where id = '00000000-0000-7000-8000-0000000009a1';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.places), 0, 'a public profile keeps its Atlas private by default');

-- at1 shows their Atlas (a column people may set themselves).
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
update public.profiles set atlas_public = true where id = '00000000-0000-7000-8000-0000000009a1';
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.places), 3, 'a shown Atlas is readable: live places only');

reset role;
set local role anon;
select is((select count(*)::int from public.places), 3, 'visitors read a shown Atlas too');

-- A block hides it again.
reset role;
insert into public.blocks (id, blocker_id, blocked_id) values ('01926000-0000-7000-8000-0000000009c1', '00000000-0000-7000-8000-0000000009a1', '00000000-0000-7000-8000-0000000009a2');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.places), 0, 'a block hides the Atlas');

-- Atlas cards are a card kind.
reset role;
select lives_ok(
  $$ insert into public.cards (id, user_id, kind, template_id, size, params)
     values ('01926000-0000-7000-8000-0000000009d1', '00000000-0000-7000-8000-0000000009a1', 'atlas', 'atlas', 'story', '{}') $$,
  'cards take the atlas kind'
);

select * from finish();
rollback;
