-- pgTAP tests for the card image bucket. Run with `pnpm db:test` (local stack must be running).
begin;
select plan(5);

select is((select public from storage.buckets where id = 'cards'), true, 'the cards bucket is public (link previews)');
select is((select file_size_limit from storage.buckets where id = 'cards'), 5242880::bigint, 'card PNGs are capped at 5 MB');
select is((select allowed_mime_types from storage.buckets where id = 'cards'), array['image/png'], 'only PNGs');

insert into auth.users (id, email) values ('00000000-0000-7000-8000-0000000000d1', 'd1@example.com');

-- A signed-in user can't write into the bucket directly, not even into their own folder.
set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-7000-8000-0000000000d1", "role": "authenticated"}';
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('cards', '00000000-0000-7000-8000-0000000000d1/x.png', '00000000-0000-7000-8000-0000000000d1') $$,
  '42501', null, 'users cannot upload card images directly'
);

set local role anon;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('cards', 'anyone/x.png') $$,
  '42501', null, 'anonymous visitors cannot upload'
);

select * from finish();
rollback;
