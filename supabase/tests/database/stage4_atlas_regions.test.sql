-- pgTAP tests for the Atlas's regions (stage 4, ADR 0060): place_regions.
-- Run with `pnpm db:test`.
begin;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000009e1', 'ar1@example.com'),
  ('00000000-0000-7000-8000-0000000009e2', 'ar2@example.com');

-- ar1 marks two provinces of Thailand and a prefecture of Japan.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009e1", "role": "authenticated"}';
insert into public.place_regions (id, region) values
  ('01926000-0000-7000-8000-0000000009f1', 'TH-10'),
  ('01926000-0000-7000-8000-0000000009f2', 'TH-50'),
  ('01926000-0000-7000-8000-0000000009f3', 'JP-13');
select is(
  (select array_agg(country order by region)::text from public.place_regions),
  '{JP,TH,TH}',
  'a region''s country is its first two letters'
);
select throws_ok(
  $$ insert into public.place_regions (id, region) values ('01926000-0000-7000-8000-0000000009f4', 'TH-10') $$,
  '23505', null, 'one live row per region'
);
select throws_ok(
  $$ insert into public.place_regions (id, region) values ('01926000-0000-7000-8000-0000000009f5', 'th-10') $$,
  '23514', null, 'only region ids'
);
select throws_ok(
  $$ insert into public.place_regions (id, region, country) values ('01926000-0000-7000-8000-0000000009f6', 'TH-11', 'JP') $$,
  '428C9', null, 'the country can''t be set apart from the region'
);
select throws_ok(
  $$ insert into public.place_regions (id, user_id, region) values ('01926000-0000-7000-8000-0000000009f7', '00000000-0000-7000-8000-0000000009e2', 'TH-11') $$,
  '42501', null, 'nobody marks regions for someone else'
);
select throws_ok(
  $$ update public.place_regions set region = 'TH-11' where id = '01926000-0000-7000-8000-0000000009f1' $$,
  '42501', null, 'a row keeps its region'
);
select throws_ok(
  $$ delete from public.place_regions where id = '01926000-0000-7000-8000-0000000009f1' $$,
  '42501', null, 'regions are never deleted by people (soft delete)'
);

-- Unmarking and marking again.
update public.place_regions set deleted_at = now() where id = '01926000-0000-7000-8000-0000000009f2';
insert into public.place_regions (id, region) values ('01926000-0000-7000-8000-0000000009f8', 'TH-50');
select is((select count(*)::int from public.place_regions where deleted_at is null), 3, 'a region unmarked can be marked again');

-- ar2 sees nothing until ar1's profile is public and the Atlas shown.
reset role;
update public.profiles set visibility = 'public' where id = '00000000-0000-7000-8000-0000000009e1';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009e2", "role": "authenticated"}';
select is((select count(*)::int from public.place_regions), 0, 'regions stay private while the Atlas is');

reset role;
update public.profiles set atlas_public = true where id = '00000000-0000-7000-8000-0000000009e1';
set local role anon;
select is((select count(*)::int from public.place_regions), 3, 'a shown Atlas''s live regions are readable');

-- A block hides them again.
reset role;
insert into public.blocks (id, blocker_id, blocked_id) values ('01926000-0000-7000-8000-0000000009fa', '00000000-0000-7000-8000-0000000009e2', '00000000-0000-7000-8000-0000000009e1');
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009e2", "role": "authenticated"}';
select is((select count(*)::int from public.place_regions), 0, 'a block hides them');

select * from finish();
rollback;
