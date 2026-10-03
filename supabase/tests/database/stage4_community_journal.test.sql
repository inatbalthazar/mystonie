-- pgTAP tests for members' Journal articles (stage 4, ADR 0092): journal_posts, its writer rules and visibility,
-- the team's answers (service role), journal_bylines and reports on articles. Run with `pnpm db:test`.
begin;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000009a1', 'cj1@example.com'),
  ('00000000-0000-7000-8000-0000000009a2', 'cj2@example.com');

-- cj1 writes a draft, then publishes it.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
insert into public.journal_posts (id, locale, title, body, tags, subjects)
values ('01926000-0000-7000-8000-0000000009b1', 'en', 'Why Past Lives stayed with me', 'Draft text.', '{review}', '{movie:666277,place:KR}');
select is((select count(*)::int from public.journal_posts), 1, 'writers read their drafts');

select throws_ok(
  $$ insert into public.journal_posts (id, locale, title, subjects) values ('01926000-0000-7000-8000-0000000009b2', 'en', 'Bad', '{movie:abc}') $$,
  '23514', null, 'subjects are titles of the catalogs or countries'
);
select throws_ok(
  $$ insert into public.journal_posts (id, locale, title, tags) values ('01926000-0000-7000-8000-0000000009b3', 'en', 'Bad', '{gossip}') $$,
  '23514', null, 'only the Journal''s categories'
);
select throws_ok(
  $$ insert into public.journal_posts (id, user_id, locale, title) values ('01926000-0000-7000-8000-0000000009b4', '00000000-0000-7000-8000-0000000009a2', 'en', 'Not mine') $$,
  '42501', null, 'nobody writes as someone else'
);
select throws_ok(
  $$ insert into public.journal_posts (id, locale, title, published_at, feature_request) values ('01926000-0000-7000-8000-0000000009b5', 'en', 'Self-featured', now(), 'approved') $$,
  '42501', null, 'a writer can''t feature their own article'
);

-- cj2 can't see the draft.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.journal_posts), 0, 'drafts are the writer''s only');

-- Published (with a made-up date) and sent to be Featured.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
update public.journal_posts set published_at = '2000-01-01', feature_request = 'pending' where id = '01926000-0000-7000-8000-0000000009b1';
select ok(
  (select published_at > now() - interval '1 minute' from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1'),
  'the database stamps when it''s published'
);
select throws_ok(
  $$ update public.journal_posts set feature_request = 'approved' where id = '01926000-0000-7000-8000-0000000009b1' $$,
  '42501', null, 'only the team approves'
);
select throws_ok(
  $$ update public.journal_posts set hidden_at = null where id = '01926000-0000-7000-8000-0000000009b1' $$,
  '42501', null, 'the writer can''t touch the team''s columns'
);
select throws_ok(
  $$ delete from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1' $$,
  '42501', null, 'articles are never deleted by people (soft delete)'
);

-- Everyone reads a published article: another member, and a visitor.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.journal_posts), 1, 'members read published articles');
select results_eq(
  $$ select username from public.journal_bylines(array['00000000-0000-7000-8000-0000000009a1']::uuid[]) $$,
  $$ values ('cj1'::text) $$,
  'bylines name public writers'
);
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';
select is((select count(*)::int from public.journal_posts), 1, 'visitors read published articles');

-- The team approves it (service role).
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
update public.journal_posts set feature_request = 'approved', featured_at = now(), review_note = 'Lovely.' where id = '01926000-0000-7000-8000-0000000009b1';
select is((select feature_request from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1'), 'approved', 'the team features an article');

-- Changing a Featured article's text sends it back to the team.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
update public.journal_posts set body = 'Edited after it was featured.' where id = '01926000-0000-7000-8000-0000000009b1';
select results_eq(
  $$ select feature_request, featured_at is null, review_note is null from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1' $$,
  $$ values ('pending'::text, true, true) $$,
  'an edited Featured article waits for the team again'
);
update public.journal_posts set published_at = '2001-01-01' where id = '01926000-0000-7000-8000-0000000009b1';
select ok(
  (select published_at > now() - interval '1 minute' from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1'),
  'the first publication''s time stays'
);

-- Taken down by the team: only its writer sees it.
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
update public.journal_posts set hidden_at = now() where id = '01926000-0000-7000-8000-0000000009b1';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.journal_posts), 0, 'a taken-down article is out of sight');
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select is((select count(*)::int from public.journal_posts), 1, 'its writer still sees it');

-- Back up, then the writer's page goes private: only the writer reads it.
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';
update public.journal_posts set hidden_at = null where id = '01926000-0000-7000-8000-0000000009b1';
update public.profiles set visibility = 'private' where id = '00000000-0000-7000-8000-0000000009a1';
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a2", "role": "authenticated"}';
select is((select count(*)::int from public.journal_posts), 0, 'a private writer''s articles are out of sight');
select is((select count(*)::int from public.journal_bylines(array['00000000-0000-7000-8000-0000000009a1']::uuid[])), 0, 'no byline for a private writer');

-- Back to drafts: the request to be Featured goes.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
update public.journal_posts set published_at = null where id = '01926000-0000-7000-8000-0000000009b1';
select results_eq(
  $$ select published_at is null, feature_request is null from public.journal_posts where id = '01926000-0000-7000-8000-0000000009b1' $$,
  $$ values (true, true) $$,
  'unpublishing takes it out of the team''s queue'
);

-- At most 10 new articles a day.
do $$
begin
  for i in 1..9 loop
    insert into public.journal_posts (id, locale, title) values (('01926000-0000-7000-8000-0000000009' || lpad(to_hex(200 + i), 2, '0'))::uuid, 'en', 'More');
  end loop;
end;
$$;
select throws_ok(
  $$ insert into public.journal_posts (id, locale, title) values ('01926000-0000-7000-8000-0000000009f1', 'en', 'Eleventh') $$,
  '23514', 'too many journal posts', 'ten new articles a day'
);

-- Soft delete.
update public.journal_posts set deleted_at = now() where id = '01926000-0000-7000-8000-0000000009b1';
select is((select count(*)::int from public.journal_posts where deleted_at is null and id = '01926000-0000-7000-8000-0000000009b1'), 0, 'a writer deletes their article (a soft delete)');

-- Reports may name an article.
reset role;
select lives_ok(
  $$ insert into public.reports (id, target_kind, target_id, reason) values ('01926000-0000-7000-8000-0000000009e1', 'article', '01926000-0000-7000-8000-0000000009b1', 'spam') $$,
  'reports name articles'
);

select * from finish();
rollback;
