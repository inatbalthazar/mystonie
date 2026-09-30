# S2 · Import from Letterboxd

**Stage:** 2 · Goodreads, MyAnimeList, TV Time and the CSV export came in stage 3: [S3 import & export](S3-import-export.md), which generalised this page and its routes (`/api/import/match`, `/api/import/commit`)

## Summary
Upload a Letterboxd export (`diary.csv` / `watched.csv`) and bring your film history in, which lowers the cost of switching.

## Rules
- The CSV parser is a pure function in `src/core/import/letterboxd.ts`, tested against a real sample export.
- Match rows to TMDB by title + year on the server, in batches, respecting rate limits.
- **Preview first:** matched / ambiguous / not found. The user fixes ambiguous rows, then commits.
- Keep the original watched date as `finished_at` (and the rating when present).
- Idempotent: re-importing creates no duplicates.
- Offer one "Imported N films" celebration card after the import.

## As built
Decisions and alternatives: [ADR 0033](../../decisions/0033-letterboxd-import.md).
- **Where:** `/settings/import`, linked from Settings ("Coming from Letterboxd?") and from the empty collection.
- **Pick:** the export ZIP as downloaded (read in the browser, no unzipping), or its CSVs. `diary.csv`, `watched.csv`, `ratings.csv` and `watchlist.csv` at the ZIP's root are used; `deleted/` and `orphaned/` copies are ignored. Only film names and years leave the device.
- **One row per film** (joined by name + year):
  - **Date:** the latest diary watched date → the date it was logged → the day it was marked watched → the day it was rated.
  - **Rating:** from `ratings.csv`, else the latest rated diary entry.
  - **Watchlist:** watchlist-only films are imported as **Want**.
  - **Limits:** at most 5,000 films (the newest).
- **Matching:** batches of 20 on the server, TMDB movie search by year, then without. A film is matched when:
  - exactly one film has the same name in that year (±1);
  - or it is the only film of that year under another title;
  - or it is a far better-known namesake.

  Otherwise the preview asks.
- **Preview:**
  - counts of Ready / To check / Not found;
  - "To check": tap the right poster among up to 5;
  - "Not found": **Find it** searches movies;
  - "Ready": untick to leave a film out;
  - films already in the collection wear an "In your collection" sticker.
- **Commit:** batches of 25, with a progress bar. It waits out rate limits and retries brief failures, and "Try again" resumes where it stopped. The page warns before being closed mid-way.
  - A new film is added with `finished_at` at noon on its watched date (user's time zone) and its rating.
  - A film already there keeps what was logged in Mystonie: a wanted or watching one becomes finished, and a missing rating is filled.
- **After:**
  - The "Imported N films" celebration: a `stats` card with `recap.imported`, covering the films this import finished, first to last watch, their watch time, and the best rated in the collage.
  - A summary of added / updated / already there / couldn't save.
  - Milestones crossed by the imported history are recorded without their own cards.
- **Not imported:** rewatches as separate watches (one entry per title keeps the latest date), tags, reviews, lists.
- **Measured:** 500 TMDB films listed as an export would list them auto-matched 98.6%, none wrong (ADR 0033). The `import_done` event keeps measuring it in production.

## Acceptance criteria
- [x] A 500-row export auto-matches ≥ 95% of rows. (98.6% live; `match.test.ts` covers the rules.)
- [x] Re-import creates 0 new entries. (`planImport` tests; `e2e/import.spec.ts` imports the same export twice.)
