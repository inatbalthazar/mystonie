# ADR 0037: Social: blocks through `is_public_profile`, follows of public profiles only, the feed as a security definer function

**Status:** Accepted · **Date:** 2026-09-29

## Context
The first stage 3 task ([S3 social](../product/features/S3-social.md)) adds follows, a Following feed, Stamps (kudos on a finish), blocks and people search.

Every read across users already goes through `private.is_public_profile(uid)`:
- the RLS policies on entries, logs and the gallery ([ADR 0021](0021-collection-tables-rules-in-the-database.md))
- `public_profile()` and `shared_card()` ([ADR 0027](0027-public-profiles-preferences-reports.md))

The old design ([later: social feed](../product/later/social-feed.md)) asked for one-way follows, cursor paging, no ranking, and blocks that hide both people from each other.

## Decision
**Blocks extend `is_public_profile`.** It now also requires that neither the profile's owner nor the caller (`auth.uid()`) has blocked the other (`private.is_blocked_between`, security definer, not executable by clients).
- Every existing policy and function that shows another person's data hides blocked pairs with no further change: profile, entries, episode and reading logs, gallery, follows, Stamps, feed and search.
- `public_profile()` gains `blocked_by_me` and returns the id to the blocker, so their page can say "You blocked @name" and offer Unblock.
- The blocked person sees a private profile and is never told. Blocks are readable only by the blocker.
- An `after insert or update` trigger soft-deletes follows and Stamps in both directions when a block becomes live. Unblocking doesn't restore them.
- Rejected: checking blocks in each new query. Too easy to miss one, and the old pages would still show blocked people.

**Only public profiles can be followed**, with no follow requests, so the feed never has to reason about approvals. A profile going private disappears from feeds at once through the same helper. Its follow rows stay, so going public again brings them back. Follow requests are an open question (Q10).

**Follows, Stamps and blocks follow the day-one rules:**
- client-made UUID v7 ids and soft delete (`deleted_at`)
- column grants: insert the id and target, update only `deleted_at`, no client DELETE
- one live row per pair (partial unique indexes); unstamping or unfollowing is a soft delete, and doing it again inserts a new row
- `stamps.owner_id` is copied from the entry by a trigger, so the owner's policy and the block trigger don't need a join
- limits: 2,000 live follows per person (trigger)
- Stamps rate-limited at 300 an hour, follows at 120 an hour, in the route handlers

**The feed is a security definer function** (`following_feed(before, before_id, limit)`), not a view or a client query:
- It returns finishes (the viewer's own and those of public, unblocked people they follow) with the person, the title, the Stamp count, whether the viewer stamped it, and the latest shared finish card.
- It pages by keyset over `(finished_at, id)` with an index on live finishes, and ignores `finished_at` more than a day in the future.
- One round trip replaces five client queries, and the function re-applies the visibility rules itself.
- The same approach serves `my_activity`, `follow_counts` (also for signed-out visitors, nothing for private or blocked profiles), `search_people` (wildcards escaped, 2–50 characters), `my_following` and `my_blocks`.
- Rejected: a fan-out-on-write timeline table. Unneeded at this size, and it would have to be rebuilt on every privacy change or block.

**Own finishes are in the feed.** The page is never empty for a new user, and the owner sees their Stamps where friends see them.

**No new tab in the nav.** At 360px the header has no room for another icon, so the feed is reached from Home ("From people you follow", "See all") and profiles, and people search from the feed.

Writes go through route handlers (`POST /api/follows`, `/api/stamps`, `/api/blocks`; reads `GET /api/feed`, `/api/people`) as the signed-in user, like the collection ([ADR 0022](0022-collection-writes-through-route-handlers.md)).

## Consequences
- Anything built later on `is_public_profile` (badges, the shelf, leaderboards, clubs) inherits blocks and privacy for free.
- `is_public_profile` now reads `blocks` on every cross-user row check. There are indexes on both sides of the pair, and the check runs only for rows not owned by the caller.
- No notifications for Stamps or followers yet (Q11). The activity list on `/feed` is the only place they show.
- The remote project needs `20261002090000_stage3_social.sql` when the owner takes stage 3 live.
