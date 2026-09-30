# ADR 0029: Books and manga: three catalogs, checkpoint reading logs, a Read tab

**Status:** Accepted · **Date:** 2026-09-27

## Context
[S2 books & manga](../product/features/S2-books-manga.md) extends the collection to reading:
- books from Google Books, manga, manhwa and webtoons from AniList;
- progress by page, chapter or volume, with Progress cards;
- a type switcher in search, a Read tab, and reading stats that match the collection.

Open question Q3 asked for the data shape of reading progress: extend `episode_logs` or add a sibling table.

Constraints we found (checked 2026-09-27):
- AniList answers GraphQL on POST only and allows about 30 requests a minute per client (`X-RateLimit-Limit: 30`). It has no chapter count while a manga is running: One Piece has `chapters: null`.
- Google Books gives anonymous callers a quota of 0 queries a day, so book search needs `GOOGLE_BOOKS_API_KEY`.
- Google's cover images (`books.google.com/books/content`) are sent without CORS headers. Cards render in the browser through a canvas ([ADR 0008](0008-client-side-card-rendering.md)), so those images can't be used there directly. AniList's CDN does send CORS headers.

## Decision
**Reading progress uses a sibling table, `reading_logs`, made of checkpoints.**
- One row means "I'm at chapter 1100" (`unit` is `page`, `chapter` or `volume`, plus `position`). It is not one row per chapter, so catching up on a 1,100-chapter manga is one tap.
- A log adds how far it moves past the furthest point logged before it. Going back adds nothing. The rule lives in `readingAmounts` in `src/core/collection/reading.ts`.
- Finishing a book or manga adds the rest of the way to its end when the length is known. A book finished without any logs counts all its pages, the same way a series finished without logs counts all its episodes.
- The day-one rules are the same as for `episode_logs`: v7 ids, soft delete, column grants, RLS for owners and public profiles. A point can be logged only once while it's live.
- Rejected: generalizing `episode_logs` (season/episode → unit/position). It would complicate every series query and the "Up next" logic for no gain.
- Rejected: one row per chapter. It would mean 1,100 rows to catch up and a 500-row request cap, and it doesn't fit books at all.

**Title lengths are their own columns:** `titles.page_count`, `chapter_count` and `volume_count`, each null while unknown.
- Rejected: reusing `episode_count` and `season_count` for chapters and volumes. Every reader of those columns would have to know the kind.

**Catalogs:**
- Each kind has one source (`sourceForKind`): book → `google_books`, manga → `anilist`, movie and series → `tmdb`.
- `ensureTitle(kind, id)` and `catalogDetails` dispatch on the kind, and ids are checked per catalog (`isExternalId`).
- **AniList** (`src/data/anilist.ts`):
  - It is called with POST and `cache: "force-cache"`, so Next caches the answer for a day despite the rate limit.
  - Formats MANGA and ONE_SHOT only. Light novels (NOVEL) are books, and adult titles are left out.
  - The English title comes first, like TMDB's `en-US` ([ADR 0012](0012-catalog-api-caching-and-limits.md)), then the romanized one. The native title becomes `originalName`, and the country of origin becomes `originalLanguage`.
- **Google Books** (`src/data/google-books.ts`):
  - Needs the key. Without it, book search answers 503 and "All" leaves books out.
  - `printType=books`. Mature volumes are dropped.
  - The first author is shown in search results.
- **Covers:**
  - Google Books covers are served through `GET /api/covers/[volumeId]` from our own origin: 300 px, or 575 px with `?size=large`, cached a month at the CDN. It only ever fetches Google's cover endpoint for a well-formed volume id, so it is not an open proxy.
  - `titles.poster_path` holds the volume id. For AniList it holds the full cover URL.
  - `posterUrl(source, path)` builds display URLs.
  - `isCardPosterUrl` lets a saved card show TMDB images, AniList covers or our cover proxy, and nothing else.

**Search:**
- `GET /api/search` takes `type=all|screen|book|manga`.
- Without a type it stays TMDB only, so the card maker (`/`) is unchanged.
- The collection's sheet opens on All, with a switcher: All · Movies & TV · Books · Manga.
- "All" queries the three catalogs in parallel, and a failing catalog is left out. Their popularity numbers can't be compared, so `mergeSearch` ranks by name match first (exact name, then names starting with the query, then the rest). Within each rank the catalogs take turns. "one piece" therefore shows the TMDB series and the AniList manga side by side, each labelled with its kind. (Amended by [ADR 0044](0044-games-rawg.md): a catalog's first pick with every word of the query ranks with the names starting with it.)

**Collection and stats:**
- Collection has **Watch · Read** tabs. Each tab has its own header, filters and rows.
- The Read header shows the estimated reading time, books and manga finished, and pages, chapters or volumes read.
- `titleRead` (`src/core/stats/reading.ts`) is the only source of reading numbers, like `titleWatch` for watching. The Read header, its rows and the stats page therefore agree for the same period, and a test checks this.
- Reading time is an estimate, and the UI says so: 1.5 min a page (about 300 words at 200–250 wpm), 5 min a manga chapter, 45 min a volume.
- Watch time stays watch time. Books and manga count as finished titles, but add no watch time.
- The stats page adds a reading row under the headline, a "Books & manga" share in Taste (the reading vs watching split), and reading days in the heatmap and streak. Per-month bars and records stay about watching.
- Status words follow the shelf: Reading / Want to read for books and manga, Watching / Want to watch for movies and series. The stored status stays `watching` / `want`.

**Pages and cards:**
- `/title/book/[id]` and `/title/manga/[id]` show the reading page:
  - "Log chapter N+1" in one tap, or any number;
  - a chapter/volume switch for manga;
  - a recent log with undo;
  - a Progress card offered after each log;
  - "Finished it? 🎉" at the end.
- A reading Progress card carries `CardData.reading`: unit, position, total when known, reading time, and milestone.
  - `cards.reading_log_id` links it to its log, with a composite foreign key as for episodes ([ADR 0021](0021-collection-tables-rules-in-the-database.md)).
  - The existing Polaroid and Bold Stats templates draw it.
  - Book and manga Finish cards show pages, chapters and volumes, with a "Finished" stamp. In Thai the stamp reads "อ่านจบแล้ว".
- The dedicated spine and manga-panel templates from the spec's summary are left to their own task.

## Consequences
- The remote project needs `20260927170000_stage2_reading.sql`.
- Book search needs a `GOOGLE_BOOKS_API_KEY` in Vercel. Until then "All" and "Manga" work without books.
- AniList's limit is shared by all our users from Vercel's IPs. The day-long fetch cache and the title cache in Postgres keep us well under it for now. If 429s show up, cache searches in Postgres or add the Jikan fallback that [external APIs](../architecture/external-apis.md) names.
- Catching up by logging a high chapter counts every chapter up to it on that day, as "Mark season watched" does for series. Weekly recaps don't include reading yet: the recap and Year in Review task can add it.
- Rows for running manga have no total. They show "Chapter 1,100" without "/ total", and no milestone.
