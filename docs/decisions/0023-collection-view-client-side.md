# ADR 0023: The collection page filters in the browser and remembers the layout per device

**Status:** Accepted · **Date:** 2026-09-27

## Context
The collection page ([S1 collection → Collection view](../product/features/S1-collections.md)) needs:
- a tiles/list toggle, "remembered per user";
- year and status filters and three sorts;
- a summary header that always equals the sum of the rows shown.

A user has at most 1,000 entries in stage 1 (`listCollection` limit), plus their episode logs.

## Decision
- **Filter, sort and sum in the browser.**
  - The page loads every live entry (with the title's genres, runtime and episode count) and every live episode log (`watchLogs`) once.
  - `src/core/collection/view.ts` builds the rows (`collectionRows`), the year options (`collectionYears`), the order (`sortRows`) and the header (`summarizeRows`).
  - Both the rows and the header come from `titleWatch`, so they agree by construction, and an edit (a finish date moved to another year) updates both at once without a round trip.
  - Rejected: filtering with query parameters on the server. It costs a round trip per tap and makes optimistic edits harder, for a data set that is small.
- **Years are calendar years in the profile's time zone** (`yearRange`). A year shows the titles finished in it or with an episode logged in it, and each row's numbers are for that year. A year with nothing left in it falls back to all time.
- **The layout is kept in `localStorage`** (`mystonie.collection.layout`, read with `useSyncExternalStore`). Rejected: a `profiles` column. That needs a migration, a settings route and a write per toggle, for a display preference that can reasonably differ between a phone and a laptop. The first paint (server render) is always the list; a stored "tiles" switches right after hydration.
- Filters and sort are not remembered: every visit starts at all time, by date.

## Consequences
- Episodes logged from "Up next" on the same page update the header on the next visit, not live (they live in another component). This goes away when "Up next" moves to Home.
- Past ~1,000 entries, filtering should move to the server (the limit in `listCollection` already caps the page).
