-- Stage 4: deeper stats (ADR 0047). Who made each title: the top-billed cast, directors (a series' creators) and
-- studios from TMDB, a book's authors from Google Books, a manga's story and art from AniList, a game's developers
-- from RAWG. The stats page counts them over the titles someone finished (favourite actor, director, studio, …).
--
-- `credits` is null until the title's details are fetched with them (`saveTitle`); older rows get them the next time
-- they're refreshed, or from the one-off backfill (`POST /api/admin/backfill-credits`). Items:
-- `{ "role": "actor"|"director"|"studio"|"author"|"developer", "id": text, "name": text, "image": text|null }`.

alter table public.titles
  add column credits jsonb check (
    credits is null or (jsonb_typeof(credits) = 'array' and jsonb_array_length(credits) <= 20)
  );

comment on column public.titles.credits is
  'Who made the title (role, id, name, image), at most 20; null until fetched. Written by the server only.';
