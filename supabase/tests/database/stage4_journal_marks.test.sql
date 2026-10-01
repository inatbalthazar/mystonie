-- pgTAP tests for Stamps and Saves on Journal articles (stage 4, ADR 0052): journal_marks and journal_stamp_counts.
-- Run with `pnpm db:test`.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000008a1', 'jm1@example.com'),
  ('00000000-0000-7000-8000-0000000008a2', 'jm2@example.com');

-- jm1 stamps and saves one article, stamps another.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008a1", "role": "authenticated"}';
insert into public.journal_marks (id, slug, kind) values
  ('01926000-0000-7000-8000-0000000008b1', 'pgtap-journal-one', 'stamp'),
  ('01926000-0000-7000-8000-0000000008b2', 'pgtap-journal-one', 'save'),
  ('01926000-0000-7000-8000-0000000008b3', 'pgtap-journal-two', 'stamp');
select is(
  (select count(*)::int from public.journal_marks),
  3,
  'people read their own marks'
);
select throws_ok(
  $$ insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008b4', 'pgtap-journal-one', 'stamp') $$,
  '23505', null, 'one live Stamp per person and article'
);
select throws_ok(
  $$ insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008b5', 'Not A Slug', 'save') $$,
  '23514', null, 'only article slugs'
);
select throws_ok(
  $$ insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008b6', 'pgtap-journal-one', 'like') $$,
  '23514', null, 'only stamp and save'
);
select throws_ok(
  $$ insert into public.journal_marks (id, user_id, slug, kind) values ('01926000-0000-7000-8000-0000000008b7', '00000000-0000-7000-8000-0000000008a2', 'pgtap-journal-one', 'stamp') $$,
  '42501', null, 'nobody marks for someone else'
);
select throws_ok(
  $$ update public.journal_marks set slug = 'pgtap-journal-two' where id = '01926000-0000-7000-8000-0000000008b2' $$,
  '42501', null, 'a mark only changes by being taken back'
);
select throws_ok(
  $$ delete from public.journal_marks where id = '01926000-0000-7000-8000-0000000008b2' $$,
  '42501', null, 'marks are never deleted by people (soft delete)'
);

-- Taking a Stamp back, then stamping again.
update public.journal_marks set deleted_at = now() where id = '01926000-0000-7000-8000-0000000008b3';
insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008b8', 'pgtap-journal-two', 'stamp');
select is(
  (select count(*)::int from public.journal_marks where slug = 'pgtap-journal-two' and deleted_at is null),
  1,
  'a Stamp taken back can be given again'
);

-- jm2 sees none of jm1's marks, and stamps the first article too.
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008a2", "role": "authenticated"}';
select is((select count(*)::int from public.journal_marks), 0, 'nobody reads someone else''s marks');
insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008c1', 'pgtap-journal-one', 'stamp');
select results_eq(
  $$ select slug, stamps from public.journal_stamp_counts() where slug like 'pgtap-journal-%' order by slug $$,
  $$ values ('pgtap-journal-one'::text, 2), ('pgtap-journal-two', 1) $$,
  'Stamp counts: live Stamps only, Saves don''t count'
);

-- Signed-out visitors see the counts, never the marks.
reset role;
set local role anon;
select is(
  (select stamps from public.journal_stamp_counts() where slug = 'pgtap-journal-one'),
  2,
  'visitors see Stamp counts'
);
select throws_ok($$ select * from public.journal_marks $$, '42501', null, 'visitors cannot read marks');

-- The cap: 1,000 live marks of a kind per person.
reset role;
insert into public.journal_marks (id, user_id, slug, kind)
select ('01926000-0000-7000-8000-' || lpad(to_hex(1000000 + g), 12, '0'))::uuid, '00000000-0000-7000-8000-0000000008a2', 'pgtap-cap-' || g, 'save'
from generate_series(1, 1000) g;
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008a2", "role": "authenticated"}';
select throws_ok(
  $$ insert into public.journal_marks (id, slug, kind) values ('01926000-0000-7000-8000-0000000008c2', 'pgtap-cap-over', 'save') $$,
  '23514', null, 'at most 1,000 live marks of a kind'
);

select * from finish();
rollback;
