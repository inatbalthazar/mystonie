# ADR 0057: A short plain-text bio on the profile; no nationality, gender or age fields

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner (2026-10-01) asked whether profiles should have a bio, a nationality with a flag (perhaps for statistics), and gender and age kept private. Before this change, a public profile (`/u/[username]`, Me) showed only the photo, the name, the handle and "Collecting since".

## Decision
**A bio:**
- `profiles.bio` holds plain text: up to 160 characters and 4 lines, and no control characters other than line breaks. An empty bio is null.
  - The database checks all of this.
  - `normalizeBio` in `src/core/account.ts` tidies it before saving: it trims each line, collapses runs of spaces, and drops blank lines.
- **Where it's edited:** Settings → Profile, under the username. The field has a live "79/160" count, and it's saved with the name and username.
- **Where it's shown:** on the album's cover (`/u/[username]`, Me, and Me's Stats tab), under the name, with its line breaks kept.
- **Who sees it:** visitors see it only while the profile is public. `public_profile()` returns it like the display name.
- **Links:** never linked. A URL in a bio is plain text, so bios aren't worth spamming.
- **Moderation:** the profile's existing Report button. This is the same as for reviews.
  - The name blocklist isn't applied. It is built for whole names: its substring rules would reject an ordinary bio such as "Finally using Mystonie".
- **Export:** the JSON export includes the bio.

**No nationality or flag field.** People can put a flag emoji in their bio if they want one.
- A flag next to every name invites the national fan wars that cross-border fandoms (K-drama, anime) already have.
- A list of flags means taking sides on disputed places.
- It also runs against [ADR 0007](0007-english-first-global.md)'s "nothing ties the product to a country".
- **Statistics by place** can use `profiles.country`, which already exists: the where-to-watch country, guessed and editable, and never shown ([ADR 0032](0032-where-to-watch.md)). It records where people live, not their nationality, and that is what regional trends need.
  - Showing any statistics by country needs its own decision. It should give totals only, with a minimum group size, and the Privacy page has to say so.

**No gender or age fields.**
- Nothing in the product uses them. Collecting data without a use goes against data minimization (GDPR, PDPA), and it is more to lose in a leak.
- They add a step to sign-up.
- Self-reported optional answers make poor statistics.
- A stored birth date can show that someone is under the Terms' minimum age (13, or 16 where the law says so), and that brings legal duties (for example COPPA's "actual knowledge").
- If ads or research ever need them, that is a decision of its own: optional, "prefer not to say", never shown, totals only, and stated on the Privacy page. A one-off anonymous survey can answer "who uses Mystonie" without storing anything on accounts.

## Consequences
- New migration `20261015090000_stage4_profile_bio.sql`. It adds the column and its update grant, and redefines `public_profile()` with `bio` last. It is tested in `stage4_profile_bio.test.sql`, and it must be on the remote project before this code deploys: Settings, Me and `/u/` read `bio`.
- The Privacy page lists the bio among what a public page shows.
- `e2e/profile.spec.ts` covers:
  - the limit
  - the tidying
  - the export
  - the public page, where the bio is not a link
  - hiding the bio once the profile is private
