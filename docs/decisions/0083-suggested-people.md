# ADR 0083: Suggested people on Find people

**Status:** Accepted · **Date:** 2026-10-02 · Extends Find people ([S3 social](../product/features/S3-social.md))

## Context
The owner (2026-10-02) asked for suggested people on Find people, based on titles you both added, the country you live in, or any other good signals.

Before this, the page only searched by username or name. A new account had nobody to find unless they already knew a username.

## Decision
**"Suggested for you"** sits under the search on `/people`. It lists up to 10 people. Each has a Follow button and one line on why they're suggested.

**Who can be suggested:** public profiles only. Never yourself, anyone you already follow, or anyone on either side of a block.

**The signals,** ranked by a score:

| Signal | Score | Line shown |
| --- | --- | --- |
| Titles you both have, any status | ×3 each | "Also has *Dune*" / "4 titles in common, like *Dune*" |
| People you follow who follow them | ×4 each | "Followed by 2 people you follow" |
| A club you're both in | +3 | "Also in the K-drama Club" |
| A country they lived in that is your own | +2 | "Lived in Thailand" |
| How much they've finished, as a tie-breaker | up to +5 | "Finished 12 titles" |

- **Your own country** is the country in your settings or a country you lived in.
- **Their side of the country signal** comes only from a place marked as lived on an Atlas they show publicly.
- **The fallback for new accounts:** with nothing else in common, someone who has finished things is still suggested, so a new account sees active collectors.
- **One line each:** the strongest reason wins (`suggestionReason` in `src/core/social.ts`). Two or more people you follow beat titles in common. A single person you follow ranks under a club or a country.

**Privacy:** every signal is already public, or is the viewer's own data:
- titles in a public collection;
- club badges on the album;
- a public Atlas;
- the viewer's own follows.

Someone's settings country (for where to watch) is private, so it never decides a suggestion for them.

**How:**
- A `security definer` function, `public.suggested_people(p_limit)`, for signed-in users only.
- Read through `suggestedPeople()` in `src/data/social.ts`. On an error, or before the function exists on a database, the section is simply hidden and the page still works.
- Following from the list is tracked as `followed` with `via: "suggested"`.

**Rejected:**
- **Matching on the settings country:** it would reveal a private setting.
- **Showing who the people in common are:** it would reveal more of the follow graph.
- **"Not interested" (dismiss):** it needs a table. It can come later if the list feels stale.
- **A precomputed table refreshed by cron:** the live query is fine at today's size.

## Consequences
- **Migration:** `20261023090000_stage4_suggested_people.sql`, with tests in `stage4_suggested_people.test.sql`. It must go to the remote database before the code is deployed. Until then the section stays hidden there; nothing else breaks.
- **Cost:** the function scans every public profile per visit. That's fine for now. A precomputed list is the next step if it gets slow.
- **Copy:** new `Social` keys (`suggestedTitle`, `suggestedHint`, `reason*`) in English and Thai.
