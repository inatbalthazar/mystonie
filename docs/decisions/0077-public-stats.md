# ADR 0077: A Stats tab on everyone's profile, its parts hidden by its owner

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0053](0053-feed-tab-stats-in-me.md) (Stats only on Me) and [ADR 0026](0026-stats-page.md) (stats for their owner only)

## Context
The owner (2026-10-02) wants everyone to see everyone's album and stats, and each person to choose which sections to hide. They also asked for a better idea, if there is one.

What was there already:
- **Album:** public albums (`/u/<username>`) were already open to everyone, signed in or not.
- **Hiding album sections:** already possible, with Arrange on Me ([ADR 0069](0069-arrange-the-album.md)).
- **Stats:** only their owner saw them, at `/stats`.
- **The data:** the rows stats are computed from (entries, and episode and reading logs) were already readable by anyone for a public profile (RLS), so showing stats exposes no new data.

## Decision
**Tabs on a profile:**
- `/u/<username>` gets the same divider tabs as Me: **Album · Stats**.
- The Stats tab is `/u/<username>/stats`, with `?period=` as on Me.
- A swipe goes between the two tabs.
- **Back leaves the profile:** both tabs replace the history entry, and the back button's stack counts them as one page (`stepBack`). Back from the Stats tab goes where the profile was opened from.

**What visitors see:**
- The same report as Me's Stats, without the parts the owner hid: the numbers, Activity (the heatmap), Per month, Taste, Favourites, Records and Milestones.
- **Not shown to visitors:**
  - **sharing:** the share button, and making a milestone's card (the stones are only to look at);
  - **the sticker album:** the album's Stickers section already shows earned ones;
  - **the year-in-review link.**
- **Headings:** "This month", not "Your month". Hints no longer say "you".
- **Time zone:** the report is computed in the viewer's time zone (UTC when signed out). The owner's time zone is never sent to a visitor.

**Hiding, on Me's Stats:**
- Each part has an eye in its corner. A tap hides that part from visitors and saves at once (`statsHidden` → `PATCH /api/account`).
- **The owner still sees every part.** A hidden part is marked "Only you", not removed, because your stats are for you first. This differs from the album, where Me shows exactly what visitors see.
- A line under the period tabs says visitors see these stats and links to "See them as visitors do".
- **The eyes show only while the profile is public.** A private profile hides everything anyway.
- **Every part hidden:** the profile has no Stats tab, and its URL says "@name keeps their stats to themselves."

**Better idea, built in: In common:**
- A signed-in visitor sees, at the top of someone's Stats tab, what they have both finished: "You've both finished N titles." and up to 8 posters, newest first (`finishedInCommon`).
- Nobody else sees it, and nothing new is exposed: the profile's finishes are on its Shelf already.

**Data:**
- `profiles.stats_hidden text[] not null default '{}'`:
  - its names are checked against `STATS_SECTIONS` in `src/core/album.ts`;
  - the owner updates it through a column grant;
  - `public_profile()` returns it while the profile is visible.
- Migration `20261022090000_stage4_public_stats.sql`, tested by `stage4_public_stats.test.sql`.

**Rejected:**
- **One switch, "Show my stats on my profile":** the owner asked for per-section choice. Hiding every part does the same.
- **Hiding stats parts in the album's Arrange sheet:** the stats aren't album sections and have a fixed order. An eye on the part itself is one tap, where you see what you're hiding.
- **Hidden by default:** the stats come from rows that are already public, and the owner wants them seen. The eyes are there for anyone who minds; Activity (which days you watch) is the obvious one to hide.
- **Visitors seeing the owner's sticker album, or the Cards tab:** the album has stickers already, and the cards stay the owner's ([ADR 0076](0076-cards-tab.md)).

## Consequences
- **Existing accounts:** their stats become visible on their public profile once this deploys. The migration must go on the remote project before the deploy (the page reads `stats_hidden`).
- **Cost:** one more server render per visit to the Stats tab: the same reads as Me's Stats, plus the visitor's finished title ids when signed in.
- **Tests:**
  - unit tests: `album.test.ts` (`statsHidden`, `parseStatsSections`), `account.test.ts`, `in-common.test.ts`, and `back.test.ts` (the profile's tabs as one page);
  - `e2e/profile.spec.ts`: the owner hides Activity, a guest sees the tab without it, a signed-in visitor sees what they both finished, and with every part hidden the tab goes.
- **Adding a stats part** means adding it to `STATS_SECTIONS`, to the migration's check list in a new migration, and to the `section` message.
