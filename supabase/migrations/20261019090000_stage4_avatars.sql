-- Stage 4: profile photos (ADR 0064). People upload their own photo, and a Google or Facebook sign-up copies the
-- provider's photo, into a public `avatars` bucket at <user_id>/<photo id>.<jpg|png|webp>; `profiles.avatar_url`
-- points at it. Like the cards bucket there are no storage.objects policies: anon and authenticated can't write.
-- POST /api/account/avatar checks the image and uploads with the service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- avatar_url was https only (Google's photo links). The local stack serves Storage over http on localhost, so a
-- photo stored there is allowed too; nothing else changes.
alter table public.profiles drop constraint profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  char_length(avatar_url) <= 500
  and (avatar_url ~ '^https://' or avatar_url ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/storage/v1/object/public/avatars/')
);
