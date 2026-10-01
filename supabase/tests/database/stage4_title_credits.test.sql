-- pgTAP tests for title credits (S4 deeper stats, ADR 0047): who made a title, cached with it. Run with `pnpm db:test`.
begin;
select plan(6);

select lives_ok(
  $$ insert into public.titles (id, kind, source, external_id, name)
     values ('20000000-0000-4000-8000-000000000c01', 'movie', 'tmdb', '990496243', 'Credits Film') $$,
  'a title starts without credits'
);
select is((select credits from public.titles where id = '20000000-0000-4000-8000-000000000c01'), null, 'null: not fetched yet');
select lives_ok(
  $$ update public.titles set credits = '[{"role": "actor", "id": "20738", "name": "Song Kang-ho", "image": null}]'
     where id = '20000000-0000-4000-8000-000000000c01' $$,
  'credits are an array of people'
);
select throws_ok(
  $$ update public.titles set credits = '{"cast": []}' where id = '20000000-0000-4000-8000-000000000c01' $$,
  '23514', null, 'credits must be an array'
);
select throws_ok(
  $$ update public.titles set credits = (select jsonb_agg(jsonb_build_object('role', 'actor', 'id', n::text, 'name', 'P' || n)) from generate_series(1, 21) n)
     where id = '20000000-0000-4000-8000-000000000c01' $$,
  '23514', null, 'at most 20 credits'
);

-- Anyone can read them with the title; nobody but the server writes them.
set local role anon;
select is(
  (select credits->0->>'name' from public.titles where id = '20000000-0000-4000-8000-000000000c01'), 'Song Kang-ho',
  'credits are readable by everyone'
);
reset role;

select * from finish();
rollback;
