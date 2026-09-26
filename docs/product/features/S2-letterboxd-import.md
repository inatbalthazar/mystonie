# S2 · Import from Letterboxd

**Stage:** 2 · Other importers (Goodreads, MyAnimeList, TV Time) are later, see [later/import-export-full.md](../later/import-export-full.md)

## Summary
Upload a Letterboxd export (`diary.csv` / `watched.csv`) and bring your film history in, which lowers the cost of switching.

## Rules
- The CSV parser is a pure function in `src/core/import/letterboxd.ts`, tested against a real sample export.
- Match rows to TMDB by title + year on the server, in batches, respecting rate limits.
- **Preview first:** matched / ambiguous / not found. The user fixes ambiguous rows, then commits.
- Keep the original watched date as `finished_at` (and the rating when present).
- Idempotent: re-importing creates no duplicates.
- Offer one "Imported N films" celebration card after the import.

## Acceptance criteria
- [ ] A 500-row export auto-matches ≥ 95% of rows.
- [ ] Re-import creates 0 new entries.
