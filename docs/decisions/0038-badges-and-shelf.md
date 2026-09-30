# ADR 0038: Badges as a code catalogue with server-only awards; the Shelf from rows the profile already reads

**Status:** Accepted · **Date:** 2026-09-29

## Context
The second stage 3 task ([S3 badges & shelf](../product/features/S3-badges-shelf.md)) adds badges ("stickers" earned from what you finish) and the Shelf on public profiles. The old design ([later: badges & shelf](../product/later/badges-and-shelf.md)) asked for:
- badge definitions as data (a `badges` table with rule JSON);
- a pure `evaluateBadges` that the server also runs, so awards can't be faked;
- a toast on unlock;
- a shelf drawn from existing poster images.

Its example "Province Hopper" (Thai provinces) is out: no country-specific features ([ADR 0007](0007-english-first-global.md)).

## Decision
**The catalogue is code, not a table.** `BADGES` in `src/core/badges.ts` holds 20 badges: slug and rule. Names and "how to earn" lines live in `messages/*.json` (`Badges.items.<slug>`), and the sticker art (icon and colour) in `src/components/badges/sticker.tsx`.
- Rule types:
  - `count`: finishes matching kind, genre and original-language filters (genre names as TMDB, AniList and Google Books spell them, lower case);
  - `distinct`: languages, genres or kinds;
  - `sameDay`: finishes on one local day, in the user's time zone.
- Rejected: a `badges` table with rule JSON. The rules need code anyway (genre aliases, time zones), translations belong in the message files, and a table would be a second place to keep in sync for no benefit before there is an admin UI.

**`evaluateBadges` replays the finishes in time order**, like milestones ([ADR 0031](0031-milestones-monthly-recap-year-in-review.md)). Each badge therefore knows its progress, when it was earned, and which title's finish earned it. Only finishes count (entries `finished` with a date); episode and reading logs don't.

**Awards are rows only the server writes: `user_badges`.**
- The table has one row per user and badge (unique), with `earned_at` and `title_id`.
- Clients get no insert, update or delete grant. `syncBadges` evaluates the user's own rows (read through RLS) and inserts the missing awards with the service role.
- The insert skips existing pairs (`on conflict do nothing`) and only returns its own rows, so two concurrent checks can't award or announce a badge twice.
- Awards are never taken back: deleting finishes keeps the sticker (the old spec's proposal, now the rule), like milestones.
- Rejected:
  - a security definer function the client calls with the slugs (it could claim any badge);
  - evaluating in SQL triggers (the genre aliases and time zones would have to be written twice);
  - computing badges on every read with no table (the public profile and the feed would have to read each person's whole collection).

**Awarding piggybacks on the milestone check.**
- `POST /api/milestones`, which the client already calls after every finish and log, now returns `{ milestones, badges }` from the same read of the user's rows (`checkProgress`).
- Imports award quietly. The stats page also awards quietly when it renders its album, so the album is never behind.
- Celebration: a user who already has badges has been checked before, so every new badge is news. On someone's first check (an existing collection meeting the feature), only badges earned in the last 2 days are celebrated; the rest are stuck in quietly.
- The route keeps its name to avoid churn; it is "the check after a save".
- Without `SUPABASE_SERVICE_ROLE_KEY` nothing is awarded. The owner's album still shows what the rules say, but profiles and the feed show nothing.

**Where stickers show:**
- the "New sticker!" toast after the Finish and Milestone cards (stamp animation, or none with reduced motion);
- the **sticker album** on `/stats`: every badge, with empty dashed spots and progress for the unearned ones;
- **Stickers** on public profiles (awarded ones only);
- on Following feed cards: the stickers that finish earned, matched by (user, title).

**The Shelf needs no new query.** The profile page already reads the collection through RLS for its summary. `shelfItems` takes the newest 48 finishes from those rows:
- movies and series stand as poster cases (a series gets a thicker "box set" edge);
- books and manga stand as coloured spines with the title running down them, with a stable colour and height per title;
- the planks are a repeating background under fixed-height rows, so they line up however the items wrap.

It is hidden for private and blocked profiles by the same RLS that hides the rest of the page.

## Consequences
- New badges are a code change: a catalogue line, two message strings and a sticker icon. The next check awards them to everyone who already qualifies, quietly for anything older than 2 days. Renaming a slug orphans its awards (reads skip unknown slugs), so slugs are permanent.
- A backdated finish that completes a rule "in the past" is still celebrated for someone who already has badges. For a first-time check it would count as old and be stuck in quietly.
- The check reads the whole collection after each save (as milestones already did). Fine at stage 3 sizes.
- The remote project needs `20261003090000_stage3_badges.sql` when stage 3 goes live, and the service role key in Vercel (already an owner go-live item).
