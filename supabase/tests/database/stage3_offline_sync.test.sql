-- pgTAP tests for offline sync (S3 offline, ADR 0042): an entry keeps when it was last edited, by the device's clock,
-- so a change that waited offline can be compared with what happened since. Run with `pnpm db:test`.
begin;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-7000-8000-0000000008f1', 'o1@example.com'),
  ('00000000-0000-7000-8000-0000000008f2', 'o2@example.com');
insert into public.titles (id, kind, source, external_id, name) values
  ('10000000-0000-4000-8000-0000000008a1', 'movie', 'tmdb', '990000081', 'Pgtap Offline One');

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008f1", "role": "authenticated"}';

insert into public.entries (id, user_id, title_id, status, edited_at) values
  ('01926000-0000-7000-8000-0000000008e1', '00000000-0000-7000-8000-0000000008f1', '10000000-0000-4000-8000-0000000008a1', 'want', '2026-01-02T03:04:05Z');
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  '2026-01-02T03:04:05Z'::timestamptz,
  'a new entry keeps the device time of the change'
);

update public.entries set status = 'watching', edited_at = '2026-01-03T00:00:00Z' where id = '01926000-0000-7000-8000-0000000008e1';
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  '2026-01-03T00:00:00Z'::timestamptz,
  'an edit keeps its device time'
);

update public.entries set status = 'finished', finished_at = now() where id = '01926000-0000-7000-8000-0000000008e1';
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  now(),
  'a change without a device time happened now'
);

update public.entries set edited_at = '2026-01-04T00:00:00Z' where id = '01926000-0000-7000-8000-0000000008e1';
update public.entries set review = review where id = '01926000-0000-7000-8000-0000000008e1';
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  '2026-01-04T00:00:00Z'::timestamptz,
  'a write that changes nothing the user sees keeps the time'
);

update public.entries set rating = 4, edited_at = now() + interval '1 hour' where id = '01926000-0000-7000-8000-0000000008e1';
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  now(),
  'a device clock ahead of the server is clamped to now'
);

update public.entries set deleted_at = now(), edited_at = '2026-01-05T00:00:00Z' where id = '01926000-0000-7000-8000-0000000008e1';
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  '2026-01-05T00:00:00Z'::timestamptz,
  'a removal keeps its device time'
);

-- Another user can't touch it (RLS as before).
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000008f2", "role": "authenticated"}';
update public.entries set edited_at = '2030-01-01T00:00:00Z' where id = '01926000-0000-7000-8000-0000000008e1';
reset role;
select is(
  (select edited_at from public.entries where id = '01926000-0000-7000-8000-0000000008e1'),
  '2026-01-05T00:00:00Z'::timestamptz,
  'other users cannot change it'
);

select * from finish();
rollback;
