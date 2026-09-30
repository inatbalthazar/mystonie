# ADR 0033: Letterboxd import read in the browser, matched in batches, saved idempotently without import tables

**Status:** Accepted · **Date:** 2026-09-29

## Context
The stage 2 task "Letterboxd import" ([S2 import](../product/features/S2-letterboxd-import.md)) brings a user's film history in from a Letterboxd export. The export is a ZIP of CSVs. The ones that matter are `diary.csv` (one row per watch, with the watched date and the rating then), `watched.csv` (every film marked watched), `ratings.csv` (the current ratings) and `watchlist.csv`. A diary row's URI points at the diary entry, not the film, and no file carries a TMDB id. Letterboxd's film data comes from TMDB, though, so names and years usually match TMDB's exactly.

The data model had planned `import_jobs` and `import_rows` tables for the preview and the commit.

The spec asks for:
- matching by title + year on the server, in batches, respecting rate limits;
- a preview (matched / ambiguous / not found) the user fixes before committing;
- the watched date as `finished_at`, plus the rating;
- no duplicates on re-import;
- one "Imported N films" card.

## Decision
**Read the export in the browser.**
- The ZIP is opened in the browser: a small central-directory reader in `src/core/import/zip.ts`, with deflate from the browser's `DecompressionStream("deflate-raw")`. Users don't have to unzip first, which is hard on a phone. No new package is needed.
- The CSVs are parsed and merged by pure functions in `src/core/import/csv.ts` and `letterboxd.ts`. Rows are joined by name + year, giving one row per film:
  - **Date:** the latest diary "Watched Date", else the date it was logged, else the day it was marked watched (`watched.csv`), else the day it was rated.
  - **Rating:** from `ratings.csv`, else the latest rated diary entry.
  - **Watchlist:** films only on the watchlist become `want` entries.
  - **Dropped:** only a watched film with no date at all.
- Only film names and years go to the server.
- Rejected: uploading the file to a route. It would add a large body and file-size limits to a function, and it would send the whole diary (tags, reviews) to the server for nothing.

**Match on the server in batches, with no import tables.**
- `POST /api/import/letterboxd/match` takes ≤ 20 films per request. Each film gets a TMDB `/search/movie` limited to its year, then (when that can't decide) one without a year. Four searches run at a time. The limit is 120 requests a minute, and the client waits out `Retry-After`.
- The preview state lives in the page until the user commits.
- `POST /api/import/letterboxd/commit` saves ≤ 25 confirmed rows per request.
- Rejected: `import_jobs` / `import_rows`. They were planned for a server-side preview. With the preview in the browser they would only store a copy of the export. They would also need a migration, RLS tests and clean-up, for a one-off flow. A closed tab loses the preview, but nothing is saved until commit, and committing again is safe.

**Matching rules** (`src/core/import/match.ts`, applied to each search):
- Names are compared normalized (accents, case, punctuation, "&"/"and"), against the name or the original name.
- **Matched** when exactly one film has the same name in the same year, else within a year (release dates drift between festival and theatrical releases).
- **Matched** when the year-limited search returns a single film from that year under another title.
- **Matched** when namesakes share the year but one is far better known: at least 100 TMDB votes and 20 times the votes of the next. A feature and a student short called "Arrival" are an example. TMDB's `vote_count` is now kept on `SearchResult` as `votes` for this.
- Otherwise the film is **ambiguous**: up to 5 candidates to tap, plus "Find it", which searches movies with the collection's search. A film nothing was found for is **not found**, with "Find it" too.
- Measured live on 500 TMDB films taken as an export would list them (top rated, popular, most voted, six original languages, five years): 98.6% auto-matched, none wrong. Without the fame rule the rate was 95.0%. The seven left were 2026 films with few votes yet.
- Rejected: fuzzy string distance. Letterboxd names come from TMDB, so a loose match mostly adds wrong matches, which are worse than a question.

**Idempotent commit** (`planImport` in `src/core/import/commit.ts`):
- A title not in the collection is inserted, with `finished_at` at noon on the watched date in the user's time zone, or now for a date the user's calendar hasn't reached.
- A title already there keeps what the user did in Mystonie. Only two things change:
  - a wanted or watching title becomes finished with the export's date;
  - a missing rating is filled in.
- Every row carries a client-made UUID v7. A retried request whose row is already saved counts as added, not twice.
- The live-entry unique index still guards against races: a 23505 plans the row again against what's there.
- Re-importing the same export therefore adds nothing (e2e checks it).
- A soft-deleted entry doesn't block a re-import. Importing again brings it back, which is what someone who re-imports asks for.

**Card and milestones.**
- The "Imported N films" card is a `stats` card with `recap.imported: true` (`period: "all"`). It counts the films this import finished, from the first watch to the last, their runtime, and a collage of the best rated.
- Saved cards validate `imported` only with `period: "all"`. No new card kind or database change is needed.
- The import's last request (`done: true`) records the milestones the imported history crossed as seen without announcing them. Years of history shouldn't set off a string of Milestone cards, and the import's own card is the celebration.

**Entry points:** Settings ("Coming from Letterboxd?") and the empty collection.

## Consequences
- No migration, and no new service or package.
- The page must stay open while matching and saving; it warns before leaving. A 500-film export takes about half a minute to match. A 5,000-film one (the cap; the newest films are kept) waits out the rate limit a few times.
- Rewatches aren't stored as separate watches: Mystonie has one entry per title, and the latest date is kept. Tags, reviews and lists aren't imported.
- The `import_done` analytics event records films, auto-matched and added counts, so the ≥ 95% target is watched after launch.
- Other importers (Goodreads, MyAnimeList, TV Time) can reuse `csv.ts`, `zip.ts` and the preview/commit split ([later/import-export-full.md](../product/later/import-export-full.md)).
