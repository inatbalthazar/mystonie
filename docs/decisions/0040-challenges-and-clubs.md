# ADR 0040: Monthly challenges and fandom clubs as code catalogues, progress written by the server, clubs defined by title filters

**Status:** Accepted · **Date:** 2026-09-29

## Context
The fourth stage 3 task ([S3 challenges & clubs](../product/features/S3-challenges-clubs.md)) adds two Strava ideas from the brief's appendix A:
- the monthly challenge, with a collectible reward ("Challenge + collectible sticker"), and the Challenge card from the brief's artwork list;
- clubs, as fandom clubs.

There was no old design in `product/later/`, only the brief's lines. Several choices had real alternatives.

## Decision
**Challenges are a code catalogue: one themed challenge per calendar month, plus three every month.**
- `src/core/challenges.ts` holds 12 themed challenges (January to December) and three that come back every month:
  - Finish Four;
  - Twenty Hours (watch plus estimated reading time, the recap numbers);
  - Twelve Days (something logged on 12 different days).
- Themes follow genres and kinds, never seasons, since seasons differ by hemisphere ([ADR 0007](0007-english-first-global.md)).
- Rules reuse the badge filters, moved into `src/core/taste.ts`: kinds, genres, original languages.
- Names and "how" lines are in `messages/*.json`, and the patch art (icon and colour) in `src/components/challenges/patch.tsx`.
- Rejected:
  - a `challenges` table edited by hand: there is no admin UI, and the rules need code anyway (time zones, reading estimates);
  - user-made challenges: they need moderation, and they add nothing before launch.

**The month is the user's local calendar month, and everything in it counts, even from before joining.**
- This matches recaps ([ADR 0025](0025-weekly-recaps.md)), and joining on the 20th still feels worth it.
- Joining is still needed. It is the commitment, and it decides whose progress is recorded, who gets the patch and the card, and what friends see.
- Only the current month can be joined:
  - the route checks the lineup and the user's local month;
  - the insert policy allows only a month either side of the current UTC month.

**Progress and completion are written by the server alone, after every save.**
- `challenge_joins` rows are the user's for joining and leaving (column grants: `id`, `user_id`, `month`, `slug`; update only `deleted_at`).
- `progress`, `completed_at` and `title_id` are written with the service role by `syncChallenges`. It evaluates the user's own rows (read through RLS) during the check after every finish or log (`POST /api/milestones`, now `{ milestones, badges, challenges }`), and also when joining and when `/challenges` renders.
- Completion is `update … where completed_at is null`, so only one of two concurrent checks announces it.
- A completed join can't be left (the update policy's `using` requires `completed_at is null`), so patches are permanent, like badges.
- Rejected:
  - computing progress on every read with no stored value: Home and friends' progress would each read whole collections;
  - letting the client report completion: it could claim any challenge.
- Stored progress can lag after a deletion, until the next save or a visit to `/challenges`. The completion itself is never taken back.

**The Challenge card is a new card kind, `challenge`, with a new template: the Calendar.**
- The month's page is torn off a wall calendar, with the days something was logged circled in stamp ink, the challenge's embroidered patch sewn on, and the title whose save completed it pasted in.
- Bold Stats and the sticker draw it too.
- `CardData.challenge` = `{ slug, month, target, days }`. The server checks that the slug is in that month's lineup and the target matches. Saving a Challenge card also requires a completed join (404 otherwise), so a shared card can't claim a challenge you didn't complete.
- It celebrates like a milestone: after the Finish card, in the same queue.

**Clubs are a code catalogue of 12 fandoms, each defined by a title filter.** Examples: K-drama (Korean series), Anime (Japanese animation), Manga, Books, C-drama, Indian Cinema, and genre clubs.
- A title "belongs" to a club when it fits the filter, so the club page fills itself from what members finish, with no curation.
- Rejected:
  - user-created clubs: names, descriptions and invitations need moderation, reports and ownership rules, which is too much for one person before launch;
  - a club per title: 100,000 near-empty clubs, and the title page's Finishers section already covers "people who finished this";
  - clubs by franchise: the catalogs don't expose franchises consistently.

**Club pages read through security definer functions that pass the filter from code.**
- `club_feed` and `club_trending` take the club slug and its filter arrays.
- The filter can't widen what anyone sees:
  - the feed returns only the caller's own finishes and those of public, unblocked members, the same rows RLS already shows;
  - trending returns counts, from 3 members up, fixed in the function.
- `private.title_fits` compares genres in lower case, like `src/core/taste.ts`.
- `club_counts` and `challenge_counts` return totals that include private profiles, never who. The Privacy Policy says so.
- Club pages are public (signed-out visitors can read them and are asked to sign in to join).
- `/challenges` needs an account.

**Where they show:**
- `/challenges`: the lineup with progress, Join / Leave, totals, the people you follow who joined (with their progress), "Make the card" and your patches;
- Home's "This month's challenges";
- `/clubs` (yours first, then by how many of your finishes fit) and `/clubs/[slug]`;
- "Clubs for this" on title pages;
- challenge patches and clubs on public profiles;
- the Following feed gets tabs to the board, challenges, clubs and people.

## Consequences
- A new challenge or club is a code change: a catalogue line, message strings and an icon. Slugs are permanent (reads skip unknown ones).
- Each save now also evaluates the month's challenges from rows it already reads. Joining and `/challenges` read the whole collection once, like the stats page.
- The remote project needs `20261005090000_stage3_challenges_clubs.sql` when the owner takes stage 3 live, and `SUPABASE_SERVICE_ROLE_KEY` (already an owner go-live item), or nothing is recorded.
