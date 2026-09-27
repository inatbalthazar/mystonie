-- pgTAP tests for the stage 0 schema. Run with `pnpm db:test` (local stack must be running).
begin;
select plan(19);

-- RLS is on for every stage 0 table.
select ok((select relrowsecurity from pg_class where oid = 'public.titles'::regclass), 'titles has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.waitlist'::regclass), 'waitlist has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.rate_limits'::regclass), 'rate_limits has RLS');

-- Seed as the table owner (bypasses RLS like the service role).
insert into public.titles (kind, source, external_id, name, year)
values ('series', 'tmdb', '66732', 'Stranger Things', 2016);

-- updated_at is stamped by the server trigger even if the client sends another value.
update public.titles set name = 'Stranger Things (2016)', updated_at = '2000-01-01' where external_id = '66732';
select isnt((select updated_at from public.titles where external_id = '66732'), '2000-01-01'::timestamptz,
  'updated_at is server-stamped');

select throws_ok(
  $$insert into public.titles (kind, source, external_id, name) values ('series', 'tmdb', '66732', 'dup')$$,
  '23505', null, 'titles are unique per (source, kind, external_id)');
select lives_ok(
  $$insert into public.titles (kind, source, external_id, name) values ('movie', 'tmdb', '66732', 'A movie')$$,
  'a movie and a series may share a TMDB id');

select throws_ok(
  $$insert into public.waitlist (email, consent_at) values ('Someone@Example.com', now())$$,
  '23514', null, 'waitlist emails must be stored lower-cased');
select has_column('public', 'waitlist', 'launch_sent_at', 'waitlist remembers who got the launch email');

-- Anonymous visitors (browser with the anon key).
set local role anon;
select is((select count(*)::int from public.titles where external_id = '66732'), 2, 'anon can read titles');
select throws_ok(
  $$insert into public.titles (kind, source, external_id, name) values ('movie', 'tmdb', '1', 'x')$$,
  '42501', null, 'anon cannot write titles');
select throws_ok(
  $$insert into public.waitlist (email, consent_at) values ('a@b.co', now())$$,
  '42501', null, 'anon cannot insert into waitlist directly');
select is((select count(*)::int from public.waitlist), 0, 'anon cannot read waitlist');
select throws_ok($$select public.rate_limit_hit('x', 60, 1)$$, '42501', null, 'anon cannot call rate_limit_hit');

-- Signed-in users get the same restrictions.
set local role authenticated;
update public.titles set name = 'hacked';
reset role;
select is((select name from public.titles where kind = 'series' and external_id = '66732'), 'Stranger Things (2016)',
  'authenticated cannot update titles (RLS filters every row)');

-- Rate limiter: allows up to max hits per window, then refuses.
select ok(public.rate_limit_hit('test:ip', 60, 2), 'first hit is allowed');
select ok(public.rate_limit_hit('test:ip', 60, 2), 'second hit is allowed');
select ok(not public.rate_limit_hit('test:ip', 60, 2), 'third hit in the same window is refused');

-- Old windows are pruned (hourly by pg_cron), so IP hashes don't outlive a day.
insert into public.rate_limits (key, window_start, count) values ('test:old', now() - interval '2 days', 1);
select public.rate_limits_prune();
select is((select count(*)::int from public.rate_limits where key = 'test:old'), 0, 'prune drops windows older than a day');
select is((select schedule from cron.job where jobname = 'rate-limits-prune'), '17 * * * *', 'prune is scheduled hourly');

select * from finish();
rollback;
