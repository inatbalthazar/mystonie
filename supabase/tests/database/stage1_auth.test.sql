-- pgTAP tests for stage 1 auth (profiles). Run with `pnpm db:test` (local stack must be running).
begin;
select plan(20);

select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'profiles has RLS');

-- Sign-ups as Supabase Auth inserts them.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-7000-8000-000000000001', 'jane.doe+films@example.com',
   '{"signup_locale": "th", "signup_time_zone": "Asia/Bangkok"}'),
  ('00000000-0000-7000-8000-000000000002', 'jane_doe@example.org', '{"signup_time_zone": "Not/AZone"}'),
  ('00000000-0000-7000-8000-000000000003', 'x@example.com',
   '{"full_name": "สมชาย ใจดี", "avatar_url": "https://lh3.googleusercontent.com/a/abc"}'),
  ('00000000-0000-7000-8000-000000000004', 'admin@example.com', '{"signup_locale": "<script>"}'),
  ('00000000-0000-7000-8000-000000000005', 'someone@example.com', '{"full_name": "Kim Ji-won"}');

select is((select count(*)::int from public.profiles where id::text like '00000000-0000-7000-8000-00000000000_'), 5,
  'every auth user gets a profile');
select is((select username from public.profiles where id = '00000000-0000-7000-8000-000000000001'), 'jane_doe',
  'username comes from the email local part without the +tag');
select is((select locale || ' ' || time_zone from public.profiles where id = '00000000-0000-7000-8000-000000000001'),
  'th Asia/Bangkok', 'locale and time zone come from the sign-up metadata');
select matches((select username from public.profiles where id = '00000000-0000-7000-8000-000000000002'),
  '^jane_doe[0-9]{4}$', 'a taken username gets 4 digits');
select is((select time_zone from public.profiles where id = '00000000-0000-7000-8000-000000000002'), 'UTC',
  'an unknown time zone falls back to UTC');
select is((select locale from public.profiles where id = '00000000-0000-7000-8000-000000000002'), 'en',
  'locale defaults to en');
select matches((select username || '|' || display_name || '|' || avatar_url from public.profiles
  where id = '00000000-0000-7000-8000-000000000003'),
  '^collector([0-9]{4})?\|สมชาย ใจดี\|https://lh3\.googleusercontent\.com/a/abc$',
  'non-Latin names fall back to "collector" (plus digits when taken)');
select isnt((select username from public.profiles where id = '00000000-0000-7000-8000-000000000004'), 'admin',
  'reserved usernames are never generated');
select is((select locale from public.profiles where id = '00000000-0000-7000-8000-000000000004'), 'en',
  'a malformed locale is ignored');
select is((select username from public.profiles where id = '00000000-0000-7000-8000-000000000005'), 'kim_ji_won',
  'the display name wins over the email');

-- Signed in as user 1.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-000000000001", "role": "authenticated"}';
select is((select count(*)::int from public.profiles), 1, 'users read only their own profile');
select lives_ok($$update public.profiles set display_name = 'Jane', time_zone = 'Europe/London'
  where id = '00000000-0000-7000-8000-000000000001'$$, 'users update their own settings');
update public.profiles set display_name = 'hacked' where id = '00000000-0000-7000-8000-000000000002';
select throws_ok($$update public.profiles set created_at = now()$$, '42501', null,
  'users cannot change created_at');
select throws_ok($$insert into public.profiles (id, username) values (gen_random_uuid(), 'someone_new')$$,
  '42501', null, 'users cannot insert profiles');
select throws_ok($$update public.profiles set time_zone = 'Mars/Base' where id = '00000000-0000-7000-8000-000000000001'$$,
  '23514', null, 'time zones are validated');
select throws_ok($$update public.profiles set username = 'Bad Name!' where id = '00000000-0000-7000-8000-000000000001'$$,
  '23514', null, 'usernames are validated');
reset role;
select is((select display_name from public.profiles where id = '00000000-0000-7000-8000-000000000002'), null,
  'users cannot update someone else''s profile');

set local role anon;
select is((select count(*)::int from public.profiles), 0, 'anon cannot read profiles');
reset role;

-- Account deletion removes the auth user; the profile goes with it.
delete from auth.users where id = '00000000-0000-7000-8000-000000000001';
select is((select count(*)::int from public.profiles where id = '00000000-0000-7000-8000-000000000001'), 0,
  'deleting the auth user deletes the profile');

select * from finish();
rollback;
