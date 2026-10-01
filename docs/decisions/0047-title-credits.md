# ADR 0047: Title credits in a `titles.credits` column, fetched with the details, counted over finished titles

**Status:** Accepted · **Date:** 2026-09-30

## Context
Roadmap stage 4 asks for favourite actors, directors and studios on the stats page, Year in Review and a stats card ([S4 deeper stats](../product/features/S4-deeper-stats.md)). Nothing we cached knew who was in a title: TMDB's details call didn't ask for credits, and `titles.raw` holds whatever each catalog returned.

## Decision
- **One `credits jsonb` column on `titles`**, an array of `{ role, id, name, image }` (≤ 20), normalized in `src/core/catalog/credits.ts` from each catalog's details body. `saveTitle` fills it from the same body it caches, so every path that caches a title (search picks, episodes, adding to the collection) gets credits with no new call.
  - Rejected: a `people` table plus a `title_people` join. It's the normalized shape, but it needs its own RLS, writes and cleanup for data that is only ever read with its title and counted in memory (`statsReport` already runs on the user's titles).
  - Rejected: reading credits out of `titles.raw`. TMDB's full cast and crew is hundreds of people per title; `saveTitle` now leaves it out of `raw` and keeps the few that count.
- **TMDB: `append_to_response=credits`** on the details call (no extra request). Series use `credits` (the latest season's regulars), not `aggregate_credits` (every season, often hundreds of entries); a series' "director" is its creators (`created_by`), since TMDB lists directors per episode.
- **Roles:** actor (top-billed 5), director (3), studio (production companies, 3), author (books; a manga's story and art staff from AniList, 3), developer (games, RAWG, 3). A book author has no id, so the lower-cased name stands in.
- **Counting** is pure (`favouritePeople` in `src/core/stats/report.ts`): over the titles finished in the period, by titles, then that period's minutes, then name; top 5 per role. Cards name a favourite only from 2 titles (`FAVOURITE_MIN_TITLES`), at most 2 (`RECAP_FAVOURITES_MAX`), stored as `recap.favourites` in the card's params.
- **Backfill:** an admin route (`POST /api/admin/backfill-credits`, bearer `ADMIN_SECRET`, like the launch email) doing ≤ 50 titles per call, 4 at a time, oldest-touched first. Rows whose cached body already carries credits (books, games) are filled without a call; failures are touched so they move to the back.
  - Rejected: a pg_cron job. It would need the site URL and secret in Vault (as the weekly recaps do) for a job that runs once.

## Consequences
- The column must exist on the remote project before this code deploys (the stats rows select it).
- Until the backfill runs, titles cached earlier have no credits, and favourites count only the ones that do (a refresh fills them too: a stale title picked in search, a series' episodes).
- Series favourites lean on each show's latest regulars and creators, not every guest star.
