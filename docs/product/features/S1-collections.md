# S1 · Collection: movies & series

**Stage:** 1 · Books/manga arrive in [S2](S2-books-manga.md)

## Summary
The journal. Users search a movie or series (incl. anime and K-drama, all via TMDB), add it with a status, log episodes one tap at a time, and see everything in a collection with totals.

## Statuses
`want` (want to watch) · `watching` · `finished`. Only `finished` entries and logged episodes count toward stats.

## Logging (≤ 3 taps)
- ➕ → search-as-you-type (same as [S0](S0-card-maker.md)) → tap result → quick-add sheet with **Finished** (primary), **Watching** and **Want to watch**.
- `finished_at` defaults to **now** and is **editable**. It's stored in UTC and shown in the user's time zone.
- **Series:** the title page lists seasons and episodes (TMDB). Users tap an episode to log it, or "Mark season/series finished". Home shows a **"Next episode"** shortcut for each `watching` series (1 tap = log the next unwatched episode).
- Logging the last episode of a series asks "Finished the series? 🎉" → sets `finished`.
- Every "finished" and every episode log opens the **celebration + card** flow ([S1 share artwork](S1-share-artwork.md)).

## Collection view
1. **View toggle:** `tiles` (poster grid) or `list` (detail rows), remembered per user.
2. Title, year, genres.
3. **Length:** movies show runtime like `2h 36m (156 min)`. Series show episodes watched / total and watched runtime.
4. `finished_at` (localized).
5. **Summary header:** total watch time, titles finished, episodes watched. Filterable by year and status.

Sort: finished_at (default, newest first), title, runtime.

## Rules
- Catalog data lives once in `titles` (unique `source` + `external_id`), and user data lives in `entries` / `episode_logs`.
- One entry per (user, title) in stage 1. Re-watches are an open question.
- Entry and episode-log IDs are client-generated UUID v7. Every table has `updated_at` + `deleted_at` (day-one rules, see [AGENTS.md](../../../AGENTS.md)).
- Totals are pure functions in `src/core/stats` (`summarizeCollection(entries, episodeLogs)`), unit-tested.
- Optimistic UI: the list updates instantly, then syncs.
- "Trending" on Home uses TMDB `/trending/all/week` (no own data yet).

## Acceptance criteria
- [ ] Adding a finished movie takes ≤ 3 taps from Home and appears at the top instantly.
- [ ] "Next episode" logs S1E5 after S1E4 in one tap.
- [ ] Editing `finished_at` reorders the list and updates stats.
- [ ] Summary numbers equal the sum of visible entries (unit tests).
- [ ] Removing an entry is a soft delete.
- [ ] Works at 360px width in light and dark mode, in `en` and `th`.

## Data
`titles`, `entries`, `episode_logs` ([data model](../../architecture/data-model.md)).
