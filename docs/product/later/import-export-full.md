# F08 · Data import / export

> **Status: BUILT** in stage 3 as [S3 import & export](../features/S3-import-export.md) ([ADR 0041](../../decisions/0041-import-export.md)), which differs from this old design: everything is read in the browser, there are no import tables, and MyAnimeList goes through AniList, not Jikan. Kept for history.

**Phase:** M5 · **Priority:** Should-have (lowers the cost of switching)

## Summary
Import existing history from other platforms via **CSV** upload, and export everything back as CSV/JSON.

| Source | File | Maps to |
|---|---|---|
| Letterboxd | `diary.csv` / `watched.csv` | Watch (movie) → match via TMDB search by title + year |
| Goodreads | `goodreads_library_export.csv` (shelf `read`) | Read (book) → match via ISBN on Google Books |
| MyAnimeList | XML/CSV export (manga list, status completed) | Read (manga) → Jikan by MAL id |

## Rules
- Parsing and field mapping are pure functions in `packages/core` (one parser per source, fixture-tested with real sample exports).
- Matching runs server-side in batches (Edge Function) and respects API rate limits (Jikan is especially strict).
- The import is a **preview first**: show matched / ambiguous / not-found, and let the user fix ambiguous rows, then commit.
- Keep the original `finished_at` (watched/read date) from the source file.
- Idempotent: re-importing the same file doesn't create duplicates (unique user + title).
- Export: all entries with title metadata, as CSV (one file per group) and a full JSON.

## Acceptance criteria
- [ ] A 500-row Letterboxd export imports with ≥ 95% auto-matched.
- [ ] Re-importing creates 0 new entries.
- [ ] Export → re-import round-trips without loss.

## Data
`import_jobs` (id, user_id, source, status, counts, created_at), `import_rows` (job_id, raw json, match status, title_id).
