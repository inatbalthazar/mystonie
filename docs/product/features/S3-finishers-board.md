# S3 · Finisher #N, trending from our own logs, and the board

**Stage:** 3 · **Built:** [ADR 0039](../../decisions/0039-finishers-trending-board.md) · From the brief's "Segment + Leaderboard" (Strava) and [later: gated features](../later/README.md)

## Summary
Strava's segments and leaderboards, for finishing things.
- Everyone who finishes a title gets a numbered stamp: **"Finisher #1,204"**. It goes on the Finish card, the celebration, the title page and the feed.
- **Trending on Home** starts with what people on Mystonie finished, watched or read this week.
- **The board** ranks you and the people you follow by this week's (or month's) time.

## Rules
### Finisher #N
- **Numbering:** the first time someone finishes a title, the database gives them the next number for it (1, 2, 3, …).
  - Numbers are race-free: never a repeat, never a gap.
  - A number is kept for good: un-finishing, deleting the entry or finishing again keeps it.
  - Deleting an account removes its numbers but doesn't free them.
- **Existing finishes** got numbers in the order they were finished (then added) when this shipped.
- **Order:** it follows when Mystonie recorded the finish, not the finish date the user typed. An import gets numbers in import order.
- **Private profiles** get numbers too; only the count of finishers is public.
- **Finish card:** a round seal "FINISHER #1,204 · mystonie" on the Ticket, Polaroid, Bold Stats, Spine, Manga Panel, Film Strip and Survived templates, in both sizes.
  - "Hide on card" gets a "Finisher #" chip.
  - On a saved card the server writes the entry's number; whatever the browser sent is ignored, like `@username`.
- **Celebration:** "You're finisher #1,204 on Mystonie" under the title. It appears a moment after the stamp, when the saved entry comes back.
- **Title page** (every kind), "Finishers" section:
  - your seal and number, or the one you'd get ("Finish it and you'd be finisher #13", "Be the first: …");
  - how many people finished it on Mystonie;
  - the people you follow who finished it, in finishing order with their numbers (up to 20). This is the title's leaderboard among friends.
- **Following feed:** each finish shows "Finisher #N" next to "Finished".
- The data export includes each entry's `finisher_no`.

### Trending from our own logs
- `trending_titles(days, limit)` counts the distinct people with a finish, an episode log or a reading log of each title in the last 7 days.
- A title shows only when **at least 3 people** were on it. Private collections count, but only in totals, never who. The minimum is fixed in the database, not a parameter.
- **Home's "Trending this week":** our own titles first (any kind, books and manga too), each with a flame tag and the number of people. TMDB's weekly list fills the rest, without repeats, 9 in all.
  - The hint explains the order.
  - With no data of our own it is TMDB's list as before, so a new install is never empty.
- Tapping one opens quick add on that title (`?pick=<kind>:<id>`, now for every kind).
- Each server instance keeps the list for 10 minutes in production.

### The board
- **Who:** you and the people you follow (up to 200, most recently followed first). It is read as you, so private and blocked profiles never show.
- **Ranking:**
  - by time spent (watch time plus estimated reading time, the same numbers as the recap cards), then titles finished, then episodes;
  - ties share a place ("1, 1, 3");
  - people with nothing in the period are left out, except you: you are always on it, last and without a place while you have nothing.
- **Periods:**
  - this week (Monday to Sunday) or this month, in your time zone;
  - `/board` and `/board?period=month`;
  - both are periods in progress, so the board resets on Monday and on the 1st.
- **`/board` page** (signed in):
  - the period switch, and the board on a taped paper card with the date range;
  - medal stickers for places 1 to 3, your line highlighted, each line linking to the profile;
  - "Find people" when you follow nobody, and a hint about the rules.
- **Home:** "This week's board" (only when you follow someone), with "You're #2 of 5 this week" (or how many friends are on it), the top three plus you, and "See the board".
- **Following feed:** a link to the board in the header.

## Acceptance criteria
- [x] Two people finishing the same title at the same moment never get the same number, and numbers have no gaps. (`e2e/finishers.spec.ts`: 12 people at once get 1–12; `stage3_finishers.test.sql`: the unique constraint and the sequence)
- [x] A number survives un-finishing, deleting and finishing again, and can't be set by a client or the service role. (`stage3_finishers.test.sql`)
- [x] The Finish card and the celebration show the number, and a saved card stores the entry's number, not the browser's. (`e2e/finishers.spec.ts`; placement checked on every template and size in `/card-lab`, `e2e/cards.spec.ts`)
- [x] Trending lists a title only from 3 people, counts only this week, and never says who. (`stage3_finishers.test.sql`, `e2e/finishers.spec.ts`)
- [x] The board ranks you and the people you follow by the week's time, ties share a place, quiet people are left out, and private profiles never show. (`src/core/board.test.ts`, `e2e/finishers.spec.ts`; privacy through RLS, `stage1_collection.test.sql`, `stage3_social.test.sql`)

## Data
- `title_finish_counts`, the permanent ledger `title_finishers`, `entries.finisher_no` and the `trending_titles()` function.
- `following_feed()` also returns `finisher_no`.
- See the [data model](../../architecture/data-model.md).

## Not in this task
- A special "Trending" card template, and per-title leaderboards beyond the people you follow (a global "first finishers" list would reveal private collections).
- Board notifications ("you dropped to #3") and all-time or yearly boards.
