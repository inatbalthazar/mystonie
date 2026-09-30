# ADR 0039: Finisher numbers handed out by the database, trending counts from 3 people, the board computed from recaps

**Status:** Accepted · **Date:** 2026-09-29

## Context
The third stage 3 task ([S3 finishers & the board](../product/features/S3-finishers-board.md)) adds three things:
- numbered "Finisher #N" stamps on finish cards;
- trending from our own logs instead of only TMDB's;
- a leaderboard among friends.

The roadmap flagged that "numbering must be race-free". Several choices had real alternatives.

## Decision
**Numbers are handed out by a trigger on `entries`, serialized per title by a counter row.**
- `private.assign_finisher()` runs before every insert and update of an entry. A live finish without a number gets `private.finisher_number(title, user)`, which works like this:
  - It first looks the person up in the permanent ledger `title_finishers`.
  - Otherwise it locks the title's row in `title_finish_counts` (`select … for update`) and looks again, because another request of the same person may have just won.
  - Only then does it take the next number and write the ledger.
- The lock makes numbering gap-free and repeat-free. A rolled-back finish also rolls back its increment.
- The number is copied onto `entries.finisher_no`, so the collection, the feed, profiles and cards read it without a join.
- Clients have no grant on the column, and the trigger overwrites what the service role sends.
- Rejected:
  - `max(number) + 1` without a lock: a race gives repeats.
  - A Postgres sequence per title: sequences leave gaps on rollback, and one per title doesn't scale.
  - Numbering in the route handler: imports, the series page and future sync would each need to remember it.
  - Ordering by the user's finish date: people back-date finishes and imports, so numbers would shift.

**Numbers are permanent.** The ledger has no soft delete. Un-finishing or deleting keeps the number, and finishing again returns the same one, so re-finishing can't be used to farm an earlier or later number. Deleting an account cascades its ledger rows, but the counter never goes back, so numbers are never reused.

**Trending counts people, from 3 up, and includes private collections only as totals.**
- `trending_titles(days, limit)` is security definer and counts distinct people with a finish, episode log or reading log in the window. It is callable by anyone, since it returns no identities.
- The 3-person minimum is fixed inside the function, so no caller can lower it and read one person's activity.
- Private profiles count, because leaving them out would skew the list and the count reveals nothing about them.
- The Privacy Policy says so.
- Rejected:
  - Counting only public profiles: this makes the list emptier while adding no privacy.
  - Showing counts from 1 person: that tells a small community exactly what one person watched.

**Home blends our list with TMDB's.** Ours comes first (with a people tag), then TMDB fills up to 9, without repeats.
- The section is never empty at launch and becomes our own as people arrive, with no switch-over threshold to tune.
- Ours includes books and manga, which TMDB can't.
- `?pick=` now accepts every kind.
- Each server instance keeps the list for 10 minutes in production. This is a module-level cache, not a new service. The list is the same for everyone.

**The board is computed in TypeScript from the recap numbers, read as the viewer.**
- `periodRecaps()` (`src/data/activity.ts`) reads the period's rows of many people at once, in chunks and pages, and runs the existing `periodRecap` per person.
- So the board shows the same minutes as the recap cards, including estimated reading time.
- The weekly and monthly recap job now uses the same reader, so there is one copy of that logic.
- Reading as the viewer means RLS already drops private and blocked profiles, with no new SQL.
- Rejected: a security definer SQL leaderboard. It would duplicate the reading-time estimate in SQL and re-implement the visibility rules.
- The board covers the viewer plus at most 200 followed people, the most recently followed. That is plenty for a friends' board, and it bounds the reads.

**Ranking:** time, then finishes, then episodes, with shared places on ties. People with nothing are left out, but the viewer always shows.

## Consequences
- Every entry write runs the trigger. It exits early unless a live finish lacks a number, and it takes a lock only the first time a person finishes a title.
- A very popular title serializes its first-time finishes on one row. At our size that is microseconds; at thousands per second it would need batching.
- The board reads up to a few thousand rows per render for someone following 200 active people. Home computes it too (only the week).
- The remote project needs `20261004090000_stage3_finishers_trending.sql` when the owner takes stage 3 live. Its backfill numbers existing finishes in finish order.
