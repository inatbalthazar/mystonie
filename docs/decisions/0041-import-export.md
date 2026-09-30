# ADR 0041: Every importer reads in the browser into shared import items; MyAnimeList through AniList ids, TV Time episodes as dated logs, undated finishes dated by the title's year; the CSV export is our own import format

**Status:** Accepted · **Date:** 2026-09-30

## Context
The fifth stage 3 task ([S3 import & export](../product/features/S3-import-export.md)) adds Goodreads, MyAnimeList and TV Time imports and a CSV export to the Letterboxd import ([ADR 0033](0033-letterboxd-import.md)).

The old design ([later/import-export-full.md](../product/later/import-export-full.md)) planned three things:
- matching in an Edge Function, with Jikan for MyAnimeList;
- `import_jobs` / `import_rows` tables;
- an export that round-trips.

The exports are messy in different ways:
- **Goodreads** is one CSV with spreadsheet-formula ISBNs.
- **MyAnimeList** is gzipped XML with MAL ids, often without dates, and lists each anime season as its own title.
- **TV Time** closed in July 2026, so people hold its GDPR export: a ZIP of dozens of CSVs whose columns changed over the years. It includes tokens, IP addresses and device data.

## Decision
**One pipeline, many readers.**
- Each source has a pure reader in `src/core/import/` (`goodreads.ts`, `mal.ts`, `tvtime.ts`, `mystonie.ts`, plus the existing `letterboxd.ts`).
- Each produces the same **import item** (`items.ts`): name, year, author, the kind "Find it" searches, a **query** that says how the server finds it, and status, day or exact time, rating, review, episodes and reading checkpoints.
- `detect.ts` asks each reader in turn, so one page takes any export and the file decides.
- The preview, the matching route and the commit route are shared: `/api/import/match` and `/api/import/commit` replace the `letterboxd/…` routes.
- Everything is still read in the browser: ZIPs with our reader, `.xml.gz` with `DecompressionStream("gzip")`. Only names, years, authors, ISBNs and ids leave the device. Inside a ZIP, only the known export files are opened, so TV Time's token and device files are never read.
- Still no `import_jobs` / `import_rows` tables (ADR 0033's reasoning holds), and no migration.
- Rejected: a reader per page and route per source. The preview and saving are the hard parts, and they are the same for all.

**Matching per source, where each export is strongest.**
- **Goodreads:** Google Books `isbn:` first (ISBN-13, else ISBN-10), else `intitle:` + the author's surname. Books of that title by that author are editions of one book, so the most relevant is taken; different authors make it a question. Up to two Google Books calls a book.
- **MyAnimeList:** AniList's `idMal_in` (one request per list per batch of 20) gives manga directly, since they are ours on AniList. It gives anime their English, romanized and Japanese names, format and year.
  - Anime are then found on TMDB: films on movies, the rest on series, by up to two names, with the Japanese name compared against TMDB's original name.
  - A sequel season ("Season 2", "The Final Season", "第2期", "II") drops the marker and the year, so it finds its series.
  - Rows that land on one title are merged in the preview (`mergeItems`). A series is finished only when every season row is.
  - Rejected: Jikan (MyAnimeList's unofficial API: about 3 requests a second, one title per call, no batch); searching TMDB with MyAnimeList's romanized title alone (misses most English-named series).
- **TV Time:** TMDB `/find/{id}?external_source=tvdb_id` with TheTVDB's id, trusted only when TMDB's series has the same name (the export's id columns aren't documented). Otherwise a series search by name, plus the year TheTVDB adds to namesakes ("Doctor Who (2005)").
- **Mystonie's CSV:** each row carries its catalog id, so matching is a cache read (`ensureTitle`).

**Episodes and reading progress are saved as logs.**
- TV Time episodes become `episode_logs` with their watch time and TMDB's runtime. Only episodes TMDB lists are kept: season 0 and numbering the catalogs disagree on are dropped, not guessed.
- A show whose every episode is out and logged, in an ended series, is finished, dated by its last episode (`seriesComplete`, as on the series page).
- A MyAnimeList manga being read, with a start date, gets one reading checkpoint (chapter, else volume) on that day.
- MyAnimeList's episode counts without dates are **not** turned into logs: they would all be dated today, and this week's stats, recaps and challenges would fill with years of history.
- Rows are server-generated UUID v7s (the user's rows still; a retry skips logs already there), so a batch doesn't carry thousands of client ids.

**Undated finishes are dated 1 January of the title's year.**
- MyAnimeList often has no dates, and a finish needs one.
- Rejected:
  - dropping undated finishes (most of some lists);
  - dating them today (they would count as this week's and this month's finishes, and complete challenges);
  - asking the user per title (hundreds of questions).
- The preview says so: "Finished (no date, so it's dated by its year)".
- A start date, when there is one, is used first.

**Status only moves forward.** `planImport` now handles every status:
- want → watching → finished, never back;
- a missing rating or review is filled in;
- anything else the user logged in Mystonie stays.

Re-importing the same file adds no entries and no logs.

**The CSV export is our own import format.**
- `GET /api/account/export/csv` writes `collection.csv`, `episodes.csv` and `reading.csv` into a stored (uncompressed) ZIP. The writer is `writeZip` in `zip.ts`, with CRC-32; no package.
- The files are UTF-8 with a BOM. Formula-looking cells get a leading `'`, which importing removes.
- Importing it restores everything exactly: exact finish times, reviews, logs. That is the round-trip criterion, checked by importing one account's export into another in e2e.
- The JSON export ([ADR 0027](0027-public-profiles-preferences-reports.md)) stays the complete GDPR copy, deleted rows included.
- Rejected: one CSV with everything (episodes don't fit a row per title); separate downloads (three taps, and the import would need all three picked).

**The card counts in the import's unit.** `recap.importedUnit` (film, series, book, manga, title) changes "Imported 312 films" to books, shows, manga or titles. It is absent for films, so older cards read the same.
- The card covers the titles the import finished or logged history for, their minutes and episodes.
- Its headline counts `titleCount`, which equals `finished` on Letterboxd cards.

## Consequences
- **Goodreads quota:** it spends Google Books quota, up to 2 calls a book. The Books API's daily quota per project is set in Google Cloud (Quotas); check it at books go-live. A large library may need it raised, which is free to request. The route's 120/min limit stays.
- **TV Time timing:** a TV Time import fetches every season of each show once (then cached). Batches carry at most 5 such shows, and the commit route may run up to 60 s.
- **New catalog calls:**
  - TMDB `/search/tv` with `first_air_date_year`;
  - TMDB `/find` by TheTVDB id;
  - AniList `Page(media(idMal_in))`;
  - Google Books `isbn:` / `intitle:` / `inauthor:` queries.
- `import_done` changes to `{ source, titles, auto, added }`. Nothing reads it yet.
- A new source is one reader and its fixtures; everything after `parseExport` is shared.
