# S1 · Collection: movies & series

**Stage:** 1 · Books/manga arrive in [S2](S2-books-manga.md)

## Summary
The journal. Users search a movie or series (incl. anime and K-drama, all via TMDB), add it with a status, log episodes one tap at a time, and see everything in a collection with totals.

## Statuses
`want` (want to watch) · `watching` · `finished`. Only `finished` entries and logged episodes count toward stats.

## Logging (≤ 3 taps)
- ➕ → search-as-you-type (same as [S0](S0-card-maker.md)) → tap result → quick-add sheet with **Finished** (primary), **Watching** and **Want to watch**.
- `finished_at` defaults to **now** and is **editable**. It's stored in UTC and shown in the user's time zone.
- **Built (quick add, [ADR 0022](../../decisions/0022-collection-writes-through-route-handlers.md)):**
  - The ➕ sits in the middle of the nav island on every signed-in page ([ADR 0050](../../decisions/0050-mobile-first-nav-island.md)). Elsewhere it opens `/collection?add=1`; on `/collection` it opens the sheet in place.
  - The sheet has search → result → **Finished** (primary, with a "Finished on" date field defaulting to today) / **Watching** / **Want to watch**.
  - Tapping a row opens an edit sheet: status, finish date, and "Remove from collection" (two taps, soft delete).
  - A picked day becomes now (today) or noon that day in the profile's time zone (`finishedAtForDate`).
  - Adding a title that's already in the collection updates its entry.
  - Sign-in without a `next` lands on Home (`/home`).
- **Series:** the title page lists seasons and episodes (TMDB). Users tap an episode to log it, or "Mark season/series finished". Home shows a **"Next episode"** shortcut for each `watching` series (1 tap = log the next unwatched episode).
- Logging the last episode of a series asks "Finished the series? 🎉" → sets `finished`.
- **Built (series):**
  - `/title/series/[id]` (signed-in) shows progress, a **Next episode** button, and seasons with tap-to-log / tap-to-unlog episodes plus "Mark season N watched".
  - "Up next" on Home (`/home`) shows each `watching` series' next episode with a one-tap **Log E5**.
  - `POST /api/episodes` logs one or many episodes (runtime copied from the episode, else the series' typical runtime) and puts the series in the collection as `watching` (a `want` entry moves to `watching`). `PATCH /api/episodes/[id]` un-logs (soft delete).
  - Rules (`src/core/collection/episodes.ts`): only aired episodes of numbered seasons count, so specials (season 0) and future episodes are skipped. "Next" is the first unlogged episode after the furthest logged one. "Finished the series?" is asked only when TMDB says the series ended and every episode is logged.
  - Episodes are cached in `title_episodes` from TMDB (all seasons, 4 at a time): refreshed after 1 day for running series and 30 days for ended ones. A series added by quick add gets its episodes cached right after (`after()`).
- Every "finished" opens the **celebration + card** flow, and every episode log on the series page offers a Progress card ([S1 share artwork](S1-share-artwork.md)). The celebration's rating and one-line review are saved on the entry (`PATCH /api/entries/[id] { rating, review }`).

## Collection view
1. **View toggle:** `tiles` (poster grid) or `list` (detail rows), remembered per user.
2. Title, year, genres.
3. **Length:** movies show runtime like `2h 36m (156 min)`. Series show episodes watched / total and watched runtime.
4. `finished_at` (localized).
5. **Summary header:** total watch time, titles finished, episodes watched. Filterable by year and status.

Sort: finished_at (default, newest first), title, runtime.

**Built ([ADR 0023](../../decisions/0023-collection-view-client-side.md)):**
- The summary header is a taped-in ticket ("All time so far" / "Your 2026") with watch time, titles finished and episodes watched.
- Under it: **Year** (years with a finish or an episode log, in the profile's time zone), **Status**, **Sort by** (Date / Title / Length), a title count and the list / posters toggle.
- List rows show title, kind · year · up to two genres, the length (movie `2h 36m (156 min)`; series `3 / 7 episodes · 2h 15m`), the localized date and the status stamp. Tiles are tilted posters in paper frames with the stamp and the short length.
- A year keeps titles finished that year or with an episode logged that year, and each row's numbers are for that year. The header is always the sum of the rows (`src/core/collection/view.ts`).
- Length sort uses the shown length (movie runtime, series watched time). Title sort follows the user's language (`Intl.Collator`).
- The layout is remembered per device (`localStorage`), not per account. Filters reset on each visit.
- No matches → "Nothing on this page yet" + "Show everything".

## Rules
- Catalog data lives once in `titles` (unique `source` + `external_id`), and user data lives in `entries` / `episode_logs`.
- One entry per (user, title) in stage 1. Re-watches are an open question.
- Entry and episode-log IDs are client-generated UUID v7 (`uuidv7()` in `src/core/ids.ts`; the DB rejects other versions). Every table has `updated_at` + `deleted_at` (day-one rules, see [AGENTS.md](../../../AGENTS.md)). Clients can't hard-delete, and a `finished` entry always has `finished_at` ([ADR 0021](../../decisions/0021-collection-tables-rules-in-the-database.md)).
- Totals are pure functions in `src/core/stats`, unit-tested. `summarizeCollection(titles, entries, episodeLogs, range?)` gives the header numbers, and `titleWatch(title, entry, logs, range?)` gives each row's numbers. The summary is always the sum of the rows. Counting rules:
  - A movie counts its runtime once it's `finished`, on `finished_at`.
  - A series counts each logged episode on its `watched_at`, using the runtime stored on the log (else the title's typical episode runtime).
  - A series marked finished **without any logged episodes** counts all its episodes (runtime × episode count) on `finished_at`, like its Finish card. Once it has logs, only the logs count, so nothing is counted twice.
  - Logged episodes count even without an entry. Soft-deleted rows never count.
- Runtimes are shown with `formatRuntime` (`2h 36m`) and `formatMinutes` (`156 min`) from `src/core/format/runtime.ts`.
- Optimistic UI: the list updates instantly, then syncs.
- "Trending" on Home uses TMDB `/trending/all/week`: 9 movies and series. Since stage 3, what people on Mystonie finished this week comes first ([S3 finishers & the board](S3-finishers-board.md)), and `pick` takes every kind. Tapping one opens quick add on its status step (`/collection?add=1&pick=movie:496243`), so a trending title is two taps from finished ([ADR 0028](../../decisions/0028-home-pwa-web-push.md)).

## Acceptance criteria
- [x] Adding a finished movie takes ≤ 3 taps from Home and appears at the top instantly. (`e2e/collection.spec.ts`: header ➕ → result → Finished from `/`, row shown before the server answers.)
- [x] "Next episode" logs S1E5 after S1E4 in one tap. (`e2e/series.spec.ts`; `nextEpisode` unit tests.)
- [x] Editing `finished_at` reorders the list and updates stats. (`e2e/collection.spec.ts`: the header and the year filter follow the new date; `view.test.ts`.)
- [x] Summary numbers equal the sum of visible entries (unit tests: `src/core/stats/summary.test.ts`).
- [x] Removing an entry is a soft delete. (`PATCH /api/entries/[id]` sets `deleted_at`; clients have no DELETE privilege, pgTAP.)
- [x] Works at 360px width in light and dark mode, in `en` and `th`. (Collection list and tiles checked by screenshot, 2026-09-27.)

## Data
`titles`, `entries`, `episode_logs` ([data model](../../architecture/data-model.md)).
