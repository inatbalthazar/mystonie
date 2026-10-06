-- pgTAP tests for a lively album, honestly (ADR 0098): Stonie's account and its Stamps, new members following the
-- official accounts, visits and invites. Run with `pnpm db:test`.
begin;
select plan(34);

-- Stonie is there, labelled, and can't sign in.
select is(
  (select username || ' ' || official from public.profiles where id = '5707e000-0000-4000-8000-000000000001'),
  'stonie mascot', 'Stonie has an account with the Mascot label'
);
select ok(
  (select banned_until > now() and encrypted_password = '' from auth.users where id = '5707e000-0000-4000-8000-000000000001'),
  'nobody can sign in as Stonie'
);

-- Two new members (public) and a team account made official by the team's route.
insert into auth.users (id, email) values ('00000000-0000-7000-8000-0000000009a0', 'team@example.com');
update public.profiles set username = 'pgtap_team', official = 'team' where id = '00000000-0000-7000-8000-0000000009a0';
insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000009a1', 'l1@example.com'),
  ('00000000-0000-7000-8000-0000000009a2', 'l2@example.com');
update public.profiles set username = 'pgtap_lia' where id = '00000000-0000-7000-8000-0000000009a1';
update public.profiles set username = 'pgtap_bo' where id = '00000000-0000-7000-8000-0000000009a2';

select is(
  (select array_agg(followee_id order by followee_id) from public.follows where follower_id = '00000000-0000-7000-8000-0000000009a1' and deleted_at is null),
  array['00000000-0000-7000-8000-0000000009a0', '5707e000-0000-4000-8000-000000000001']::uuid[],
  'a new member follows Stonie and the team'
);
select is(
  (select count(*)::int from public.follows where follower_id = '5707e000-0000-4000-8000-000000000001'),
  0, 'Stonie follows nobody'
);

set local role anon;
select is(
  (select array_agg(official order by official) from public.official_accounts() where username in ('stonie', 'pgtap_team')),
  array['mascot', 'team'], 'anyone can see who is official'
);
select throws_ok($$ select public.record_view('profile', '00000000-0000-7000-8000-0000000009a1', 'visitor-aaaaaaaaaaaa', null) $$, '42501', null, 'visitors cannot count visits themselves');
reset role;

-- Stonie stamps Lia's first finish, her first book and her 10th; not her second movie.
insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000009b1', 'movie', 'tmdb', 'pgtap-lively-1', 'Lively One'),
  ('10000000-0000-4000-8000-0000000009b2', 'movie', 'tmdb', 'pgtap-lively-2', 'Lively Two'),
  ('10000000-0000-4000-8000-0000000009b3', 'book', 'google_books', 'pgtap-lively-3', 'Lively Book');
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000009e1', '00000000-0000-7000-8000-0000000009a1', '10000000-0000-4000-8000-0000000009b1', 'finished', '2026-09-01T10:00Z');
select is(
  (select array_agg(milestone order by milestone) from public.mascot_milestones where user_id = '00000000-0000-7000-8000-0000000009a1'),
  array['finishes:1', 'first:movie'], 'the first finish is a milestone'
);
select is(
  (select count(*)::int from public.stamps where user_id = '5707e000-0000-4000-8000-000000000001' and entry_id = '01926000-0000-7000-8000-0000000009e1'),
  1, 'Stonie stamps the first finish'
);
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000009e2', '00000000-0000-7000-8000-0000000009a1', '10000000-0000-4000-8000-0000000009b2', 'finished', '2026-09-02T10:00Z');
select is(
  (select count(*)::int from public.stamps where entry_id = '01926000-0000-7000-8000-0000000009e2'),
  0, 'a second movie is no milestone'
);
insert into public.entries (id, user_id, title_id, status) values
  ('01926000-0000-7000-8000-0000000009e3', '00000000-0000-7000-8000-0000000009a1', '10000000-0000-4000-8000-0000000009b3', 'watching');
select is(
  (select count(*)::int from public.stamps where entry_id = '01926000-0000-7000-8000-0000000009e3'),
  0, 'only finishes are stamped'
);
update public.entries set status = 'finished', finished_at = '2026-09-03T10:00Z' where id = '01926000-0000-7000-8000-0000000009e3';
select is(
  (select count(*)::int from public.stamps where user_id = '5707e000-0000-4000-8000-000000000001' and entry_id = '01926000-0000-7000-8000-0000000009e3'),
  1, 'finishing a first book is stamped'
);

-- Taking the first finish away and back doesn't stamp again.
update public.entries set deleted_at = now() where id = '01926000-0000-7000-8000-0000000009e1';
update public.entries set deleted_at = null where id = '01926000-0000-7000-8000-0000000009e1';
select is(
  (select count(*)::int from public.stamps where user_id = '5707e000-0000-4000-8000-000000000001' and owner_id = '00000000-0000-7000-8000-0000000009a1'),
  2, 'a milestone is cheered once'
);

-- An import of eight more in one go reaches 10: one Stamp for the import.
insert into public.titles (id, kind, source, external_id, name)
select ('10000000-0000-4000-8000-0000000009c' || n)::uuid, 'movie', 'tmdb', 'pgtap-lively-c' || n, 'Import ' || n from generate_series(1, 8) as n;
insert into public.entries (id, user_id, title_id, status, finished_at)
select ('01926000-0000-7000-8000-0000000009d' || n)::uuid, '00000000-0000-7000-8000-0000000009a1', ('10000000-0000-4000-8000-0000000009c' || n)::uuid, 'finished', '2020-01-01T10:00Z'
from generate_series(1, 8) as n;
select ok(
  exists (select 1 from public.mascot_milestones where user_id = '00000000-0000-7000-8000-0000000009a1' and milestone = 'finishes:10'),
  'ten finishes is a milestone'
);
select is(
  (select count(*)::int from public.stamps where user_id = '5707e000-0000-4000-8000-000000000001' and owner_id = '00000000-0000-7000-8000-0000000009a1'),
  3, 'an import is stamped once'
);

-- Lia sees Stonie's Stamps and its milestones; Bo sees none of hers.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select is(
  (select count(*)::int from public.my_activity(50) where kind = 'stamp' and user_id = '5707e000-0000-4000-8000-000000000001'),
  3, 'Stonie''s Stamps are in the activity'
);
select ok(
  (select count(*) from public.mascot_milestones) >= 3,
  'members read their milestones'
);
select throws_ok($$ insert into public.mascot_milestones (id, user_id, milestone) values ('01926000-0000-7000-8000-0000000009f9', '00000000-0000-7000-8000-0000000009a1', 'finishes:25') $$, '42501', null, 'nobody writes milestones');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is_empty($$ select * from public.mascot_milestones $$, 'milestones are their member''s own');

-- Bo blocks Stonie: no more Stamps from it.
select lives_ok(
  $$ insert into public.blocks (id, blocked_id) values ('01926000-0000-7000-8000-0000000009b9', '5707e000-0000-4000-8000-000000000001') $$,
  'Stonie can be blocked'
);
reset role;
insert into public.entries (id, user_id, title_id, status, finished_at) values
  ('01926000-0000-7000-8000-0000000009e8', '00000000-0000-7000-8000-0000000009a2', '10000000-0000-4000-8000-0000000009b1', 'finished', '2026-09-04T10:00Z');
select is(
  (select count(*)::int from public.stamps where entry_id = '01926000-0000-7000-8000-0000000009e8'),
  0, 'a member who blocked Stonie gets no Stamps from it'
);

-- Invites: Bo joined from Lia's link.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is_empty($$ select * from public.accept_invite('pgtap_bo') $$, 'nobody invites themselves');
select is_empty($$ select * from public.accept_invite('stonie') $$, 'official accounts don''t invite');
select is((select username from public.accept_invite('PGTAP_LIA')), 'pgtap_lia', 'a new account accepts an invite');
select is_empty($$ select * from public.accept_invite('pgtap_team') $$, 'an account accepts one invite');
select throws_ok($$ insert into public.invites (id, inviter_id, invitee_id) values ('01926000-0000-7000-8000-0000000009ff', '00000000-0000-7000-8000-0000000009a0', '00000000-0000-7000-8000-0000000009a2') $$, '42501', null, 'nobody writes invites');
reset role;
select is(
  (select count(*)::int from public.follows
   where deleted_at is null
     and ((follower_id = '00000000-0000-7000-8000-0000000009a1' and followee_id = '00000000-0000-7000-8000-0000000009a2')
       or (follower_id = '00000000-0000-7000-8000-0000000009a2' and followee_id = '00000000-0000-7000-8000-0000000009a1'))),
  2, 'the inviter and the new member follow each other'
);
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select is(
  (select array_agg(kind order by kind) from public.my_activity(50) where user_id = '00000000-0000-7000-8000-0000000009a2'),
  array['invite'], 'the inviter sees who joined, not a second follow'
);

-- An older account can't take an invite.
reset role;
update public.profiles set created_at = now() - interval '3 days' where id = '00000000-0000-7000-8000-0000000009a0';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a0", "role": "authenticated"}';
select is_empty($$ select * from public.accept_invite('pgtap_lia') $$, 'only new accounts accept invites');
reset role;

-- Visits: once a day per visitor, never the owner, read by the owner only.
set local role service_role;
select ok(public.record_view('profile', '00000000-0000-7000-8000-0000000009a1', 'visitor-aaaaaaaaaaaa', null), 'a visit counts');
select ok(not public.record_view('profile', '00000000-0000-7000-8000-0000000009a1', 'visitor-aaaaaaaaaaaa', null), 'the same visitor counts once a day');
select ok(not public.record_view('profile', '00000000-0000-7000-8000-0000000009a1', 'visitor-bbbbbbbbbbbb', '00000000-0000-7000-8000-0000000009a1'), 'the owner''s own visits don''t count');
select ok(public.record_view('profile', '00000000-0000-7000-8000-0000000009a1', 'visitor-cccccccccccc', '00000000-0000-7000-8000-0000000009a2'), 'a member''s visit counts');
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select is(
  (select recent || '/' || total from public.my_views(7) where subject = 'profile'),
  '2/2', 'the owner reads their visits'
);
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is_empty($$ select * from public.view_counts $$, 'nobody else reads them');

select * from finish();
rollback;
