-- pgTAP tests for beta reports (ADR 0055): written by the server only, read back only by their own reporter, and
-- deleted with the account. Run with `pnpm db:test`.
begin;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000009a1', 'feedback1@example.com'),
  ('00000000-0000-7000-8000-0000000009a2', 'feedback2@example.com');

-- The server (service role) files them: one from each account and one signed out.
insert into public.feedback (id, user_id, kind, message, page, device, locale) values
  ('01926000-0000-7000-8000-0000000009b1', '00000000-0000-7000-8000-0000000009a1', 'bug', 'The ➕ does nothing', '/collection', 'Mozilla/5.0', 'th'),
  ('01926000-0000-7000-8000-0000000009b2', '00000000-0000-7000-8000-0000000009a2', 'idea', 'Dark posters', null, null, 'en'),
  ('01926000-0000-7000-8000-0000000009b3', null, 'other', 'Hello', '/', null, 'en');

select is((select status from public.feedback where id = '01926000-0000-7000-8000-0000000009b1'), 'new', 'a report starts as new');
select throws_ok(
  $$ insert into public.feedback (id, kind, message) values ('01926000-0000-7000-8000-0000000009b4', 'praise', 'hi') $$,
  '23514', null, 'only known kinds'
);
select throws_ok(
  $$ insert into public.feedback (id, kind, message, page) values ('01926000-0000-7000-8000-0000000009b5', 'bug', 'hi', 'https://x.example/') $$,
  '23514', null, 'the page is a path'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-7000-8000-0000000009a1", "role": "authenticated"}';
select results_eq(
  $$ select id::text, status from public.feedback $$,
  $$ values ('01926000-0000-7000-8000-0000000009b1', 'new') $$,
  'a reporter reads only their own reports'
);
select throws_ok(
  $$ insert into public.feedback (id, user_id, kind, message) values ('01926000-0000-7000-8000-0000000009b6', '00000000-0000-7000-8000-0000000009a1', 'bug', 'hi') $$,
  '42501', null, 'clients cannot file reports directly'
);
select throws_ok(
  $$ update public.feedback set status = 'fixed' $$,
  '42501', null, 'clients cannot change the status'
);
reset role;

set local role anon;
select throws_ok($$ select * from public.feedback $$, '42501', null, 'signed-out visitors read nothing');
reset role;

-- The operator marks it fixed; deleting the account deletes its reports.
update public.feedback set status = 'fixed' where id = '01926000-0000-7000-8000-0000000009b1';
select is((select status from public.feedback where id = '01926000-0000-7000-8000-0000000009b1'), 'fixed', 'the operator sets the status');
delete from auth.users where id = '00000000-0000-7000-8000-0000000009a1';
select is((select count(*)::int from public.feedback where id = '01926000-0000-7000-8000-0000000009b1'), 0, 'deleting the account deletes its reports');

select * from finish();
rollback;
