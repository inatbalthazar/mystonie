-- pgTAP tests for where to watch by country (ADR 0032). Run with `pnpm db:test`.
begin;
select plan(8);

insert into auth.users (id, email) values ('00000000-0000-7000-8000-0000000000e1', 'e1@example.com');
insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000000e1', 'movie', 'tmdb', 'pgtap-watch-movie', 'A Movie'),
  ('10000000-0000-4000-8000-0000000000e2', 'series', 'tmdb', 'pgtap-watch-series', 'A Series');
insert into public.title_providers (title_id, providers) values
  ('10000000-0000-4000-8000-0000000000e1', '{"US": {"stream": [{"id": 8, "name": "Netflix", "logo": "/n.png"}]}, "TH": {"buy": [{"id": 2, "name": "Apple TV", "logo": "/a.png"}]}}');

select is(
  (select providers -> 'TH' -> 'buy' -> 0 ->> 'name' from public.title_providers where title_id = '10000000-0000-4000-8000-0000000000e1'),
  'Apple TV',
  'one country is read by its code'
);
select throws_ok(
  $$ insert into public.title_providers (title_id, providers) values ('10000000-0000-4000-8000-0000000000e2', '[]') $$,
  '23514', null, 'providers is an object'
);
select throws_ok(
  $$ insert into public.title_providers (title_id, providers)
     values ('10000000-0000-4000-8000-0000000000e2', jsonb_build_object('US', repeat(md5(random()::text), 20000))) $$,
  '23514', null, 'providers stays small'
);

set local role anon;
select results_eq(
  $$ select count(*)::int from public.title_providers where title_id = '10000000-0000-4000-8000-0000000000e1' $$,
  $$ values (1) $$,
  'anyone can read where a title streams'
);

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000e1", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.title_providers (title_id, providers) values ('10000000-0000-4000-8000-0000000000e2', '{}') $$,
  '42501', null, 'users cannot write provider data'
);
update public.title_providers set providers = '{}' where title_id = '10000000-0000-4000-8000-0000000000e1';
select lives_ok(
  $$ update public.profiles set country = 'TH' where id = '00000000-0000-7000-8000-0000000000e1' $$,
  'owners set their country'
);

reset role;
select isnt(
  (select providers from public.title_providers where title_id = '10000000-0000-4000-8000-0000000000e1'),
  '{}'::jsonb,
  'the user''s update changed nothing'
);
delete from public.titles where id = '10000000-0000-4000-8000-0000000000e1';
select is_empty(
  $$ select * from public.title_providers where title_id = '10000000-0000-4000-8000-0000000000e1' $$,
  'provider data goes with its title'
);

select * from finish();
rollback;
