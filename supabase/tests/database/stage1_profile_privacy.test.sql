-- pgTAP tests for stage 1 profile & privacy: the name blocklist, public profile reads, shared-card reads
-- and reports. Run with `pnpm db:test` (local stack must be running).
-- Users: P (public), Q (private).
begin;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-7000-8000-0000000000f1', 'pat@example.com', '{"full_name": "Pat Lee"}'),
  ('00000000-0000-7000-8000-0000000000f2', 'quinn@example.com', '{}'),
  ('00000000-0000-7000-8000-0000000000f3', 'fake@example.com', '{"full_name": "Mystonie Support"}');
update public.profiles set username = 'pat_lee_pgtap' where id = '00000000-0000-7000-8000-0000000000f1';
update public.profiles set username = 'quinn_pgtap', visibility = 'private' where id = '00000000-0000-7000-8000-0000000000f2';

select is((select display_name from public.profiles where id = '00000000-0000-7000-8000-0000000000f3'), null,
  'a blocked Google name is dropped at sign-up, and the account is still made');
select ok((select not public.is_reserved_username(username) from public.profiles
  where id = '00000000-0000-7000-8000-0000000000f3'), 'the generated username is allowed');

insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000000f1', 'movie', 'tmdb', 'pgtap-profile-movie', 'A Movie');
insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000000f1', '00000000-0000-7000-8000-0000000000f1', '10000000-0000-4000-8000-0000000000f1', 'watching'),
  ('01926000-0000-7000-8000-0000000000f2', '00000000-0000-7000-8000-0000000000f2', '10000000-0000-4000-8000-0000000000f1', 'watching');
insert into public.cards (id, user_id, entry_id, kind, template_id, size, params, shared_at) values
  ('01926000-0000-7000-8000-0000000000f3', '00000000-0000-7000-8000-0000000000f1',
   '01926000-0000-7000-8000-0000000000f1', 'progress', 'ticket', 'story', '{"username": "pat_lee_pgtap"}', now()),
  ('01926000-0000-7000-8000-0000000000f4', '00000000-0000-7000-8000-0000000000f2',
   '01926000-0000-7000-8000-0000000000f2', 'progress', 'ticket', 'story', '{"username": "quinn_pgtap"}', now()),
  ('01926000-0000-7000-8000-0000000000f5', '00000000-0000-7000-8000-0000000000f1',
   '01926000-0000-7000-8000-0000000000f1', 'progress', 'ticket', 'story', '{}', null);

-- ---------------------------------------------------------------------------
-- Names, as the owner (P).
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-0000000000f1", "role": "authenticated"}';

select throws_ok($$update public.profiles set username = 'admin' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'username not allowed', 'reserved usernames are rejected');
select throws_ok($$update public.profiles set username = 'settings' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'username not allowed', 'route names are rejected');
select throws_ok($$update public.profiles set username = 'mystonie_hq' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'username not allowed', 'names containing the brand are rejected');
select throws_ok($$update public.profiles set username = 'st0nie_fan' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'username not allowed', 'digit swaps do not get around the blocklist');
select throws_ok($$update public.profiles set username = 'fuck_this' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'username not allowed', 'profanity is rejected');
select throws_ok($$update public.profiles set display_name = 'Mystonie Team' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'display name not allowed', 'display names are checked too');
select throws_ok($$update public.profiles set display_name = 'Admin' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23514', 'display name not allowed', 'role names are not allowed as display names');
select lives_ok($$update public.profiles set username = 'yoshitaka_pornchai' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  'ordinary names that contain a short rude word are fine');
select lives_ok($$update public.profiles set username = 'pat_lee_pgtap', display_name = 'Pat' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  'ordinary names are fine');
select lives_ok($$update public.profiles set theme = 'dark' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  'other settings are not re-checked');
select throws_ok($$update public.profiles set username = 'quinn_pgtap' where id = '00000000-0000-7000-8000-0000000000f1'$$,
  '23505', null, 'usernames are unique');

-- Signed in as P: the private profile's shared cards can't be listed, but its card link works.
select is((select count(*)::int from public.cards where user_id = '00000000-0000-7000-8000-0000000000f2'), 0,
  'others cannot list the shared cards of a private profile');
select is((select coalesce(profile_username, '-') from public.shared_card('01926000-0000-7000-8000-0000000000f4')), '-',
  'a private profile''s card link works without naming the profile');
reset role;

-- ---------------------------------------------------------------------------
-- Signed out.
-- ---------------------------------------------------------------------------
set local role anon;
select is((select display_name || ' ' || is_private::text from public.public_profile('Pat_Lee_PGTAP')), 'Pat false',
  'a public profile is readable by username (any case)');
select is((select row(id, display_name, avatar_url, created_at)::text || ' ' || is_private::text
  from public.public_profile('quinn_pgtap')), '(,,,) true', 'a private profile only says that it is private');
select is((select count(*)::int from public.public_profile('nobody_here')), 0, 'unknown usernames return nothing');
select is((select array_agg(id::text) from public.cards where user_id = '00000000-0000-7000-8000-0000000000f1'),
  array['01926000-0000-7000-8000-0000000000f3'], 'the shared cards of a public profile can be listed (the gallery)');
select is((select profile_username from public.shared_card('01926000-0000-7000-8000-0000000000f3')), 'pat_lee_pgtap',
  'a shared card names its public profile');
select is((select count(*)::int from public.shared_card('01926000-0000-7000-8000-0000000000f5')), 0,
  'unshared cards are not readable by id');
select is((select count(*)::int from public.profiles), 0, 'anon still cannot read profiles');
select throws_ok($$select * from public.reports$$, '42501', null, 'anon cannot read reports');
select throws_ok($$insert into public.reports (id, target_kind, target_id, reason) values
  ('01926000-0000-7000-8000-0000000000f6', 'profile', '00000000-0000-7000-8000-0000000000f1', 'spam')$$,
  '42501', null, 'anon cannot write reports directly');
reset role;

set local role authenticated;
select throws_ok($$select * from public.reports$$, '42501', null, 'users cannot read reports');
reset role;

-- The server (service role) writes reports.
select throws_ok($$insert into public.reports (id, target_kind, target_id, reason) values
  ('01926000-0000-7000-8000-0000000000f7', 'card', '01926000-0000-7000-8000-0000000000f3', 'boring')$$,
  '23514', null, 'report reasons come from a fixed list');
select lives_ok($$insert into public.reports (id, reporter_id, target_kind, target_id, reason, note) values
  ('01926000-0000-7000-8000-0000000000f8', '00000000-0000-7000-8000-0000000000f2', 'card',
   '01926000-0000-7000-8000-0000000000f3', 'spam', 'Posts the same card every hour')$$, 'the server writes reports');
delete from auth.users where id = '00000000-0000-7000-8000-0000000000f2';
select is((select reporter_id from public.reports where id = '01926000-0000-7000-8000-0000000000f8'), null,
  'a report outlives its reporter''s account, without their id');

select * from finish();
rollback;
