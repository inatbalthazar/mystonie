-- Stage 1 share artwork: the Storage bucket for shared card PNGs (S1 share artwork, ADR 0024).
-- Objects live at <user_id>/<card id>.png (cards.image_path checks the same shape).
--
-- The bucket is public: a shared card is an explicit publish, and link previews (X, Facebook, iMessage)
-- fetch the image without a session. Nobody writes to it directly: there are no storage.objects policies
-- for the bucket, so anon/authenticated can't insert, update or delete. Uploads use a signed upload URL
-- that POST /api/cards creates with the service role after RLS accepted the card row.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 5 * 1024 * 1024, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
