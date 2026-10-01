# S3 · Social: follows, the Following feed, Stamps, blocks

**Stage:** 3 · **Built:** [ADR 0037](../../decisions/0037-social-follows-stamps-blocks.md) · Started from [later: social feed](../later/social-feed.md)

## Summary
A collection is more fun when friends can see it. Follow people, see what they finish in one feed, and press a **Stamp** (the kudos) on a finish. Blocking keeps it safe.

## Rules
- **Follow** is one-way, with no approval: only **public** profiles can be followed. Following yourself isn't possible. At most 2,000 live follows per person.
- A profile going **private** drops out of every feed and search at once. Its follows stay in the database and come back if it goes public again.
- **The Following feed** (`/feed`, signed in, titled "Feed"): the nav island's Feed tab since [ADR 0053](../../decisions/0053-feed-tab-stats-in-me.md).
  - It shows **finishes** (entries with `finished_at`), newest first: your own and those of the public people you follow. Your own finishes are in it so the page is never empty.
  - It pages by cursor (finished time, entry id), 20 at a time with "Load more". There is no ranking.
  - Each item shows who, when, the poster, or their latest shared finish card of that title (tap → `/c/[id]`), the rating, the review in handwriting, and the Stamp. The title links to the viewer's own title page.
- **Stamps:**
  - One per person per finish, and only on someone else's live finish that the stamper can see (a public profile, not blocked).
  - Tapping again takes it back (soft delete). Your own finishes show how many Stamps they got.
  - The Stamp is drawn as a rubber stamp that lands with the celebration's stamp animation (reduced motion: no animation).
- **Activity** ("Lately" on `/feed`): the latest Stamps on your finishes and new followers, with "Follow back". A new one since you last opened the feed puts a coral dot on the island's Feed tab until you open it again ([ADR 0054](../../decisions/0054-feed-dot-reel-reminders.md); per device).
- **Find people** (`/people`, signed in):
  - Search by username prefix or display-name substring (2–50 characters; a leading `@` is ignored). Only public, unblocked profiles show up, and never yourself (up to 20, with how many titles each finished).
  - The page also lists the people you follow (unfollow there) and the people you blocked (unblock there).
- **Block** (on a profile, signed in):
  - It asks first, then removes follows and Stamps in both directions.
  - After that, neither person can see the other's profile, entries, logs, gallery, feed items or search result, and neither can follow or stamp the other.
  - The blocked person isn't told: they see the blocker's page as private. The blocker sees "You blocked @name" with Unblock.
  - Unblocking restores visibility, not the removed follows.
- **Profile** (`/u/[username]`):
  - Follower and following counts, and Follow / Following. Signed-out visitors get Follow as a link to sign in, then back to the profile.
  - The owner gets a "Find people to follow" link instead.
  - Block sits next to Report.
- **Home:** "From people you follow" shows the three latest finishes of people you follow, each with a compact Stamp, and "See all" → `/feed`. With nobody to show, an invitation to find people.
- Reporting stays as in [S1 profile & privacy](S1-profile-privacy.md).
- The data export includes your follows, Stamps and blocks.
- Analytics: `followed` (`via`: profile / search / activity / people) and `stamped`.

## Acceptance criteria
- [x] Following a public user shows their next finished title in my feed. (`supabase/tests/database/stage3_social.test.sql`, `e2e/social.spec.ts`)
- [x] A private user's activity never appears in any feed (RLS test). (`stage3_social.test.sql`)
- [x] Blocking hides both users from each other's feeds and profiles. (`stage3_social.test.sql`, `e2e/social.spec.ts`)
- [x] A Stamp is one per person per finish, never on your own or a hidden finish, and the owner sees it in their activity. (`stage3_social.test.sql`, `e2e/social.spec.ts`)
- [x] Find people returns public, unblocked profiles only, and matches wildcards literally. (`stage3_social.test.sql`)

## Data
`follows`, `stamps`, `blocks` (day-one rules: UUID v7, soft delete, column grants, no client DELETE) and the feed, activity, counts and search functions. See the [data model](../../architecture/data-model.md).

## Not in this task
- Follow requests for private profiles, and notifications (push or email) for new Stamps and followers ([open questions](../../open-questions.md) Q10, Q11).
- The "Help verify" warnings card and challenge items in the feed. Challenges shipped without feed items ([S3 challenges & clubs](S3-challenges-clubs.md)); the feed links to them in its header tabs. (Badges show on the finish's feed card, [S3 badges & shelf](S3-badges-shelf.md), and so does its finisher number, [S3 finishers & the board](S3-finishers-board.md).)
