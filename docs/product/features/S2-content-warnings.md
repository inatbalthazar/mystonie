# S2 · Content warnings (from the DoesTheDogDie API)

**Stage:** 2 (first item) · **Built** 2026-09-29 ([ADR 0035](../../decisions/0035-content-warnings-cache-and-survived.md)) · Our own warnings with timestamps and the quiz: [S3 warnings & quiz](S3-warnings-quiz.md) (stage 3) · Decision: [ADR 0009](../../decisions/0009-content-warnings-from-dtdd-first.md)

## Summary
Users pick the topics they want to avoid (e.g. *a dog dies*, *jump scares*, *sexual content*, *flashing lights*, *spiders*). Title pages and cards then show warnings for those topics, using the existing community data from **DoesTheDogDie (DTDD)**.

## Behaviour
- **Settings → Content warnings** (`/settings/warnings`): choose avoid-topics from the DTDD topic list (grouped by category, searchable, chosen ones as removable stickers, saved as you go). Default: none (the feature is opt-in). Only the user can see them.
- **Title page** (movies and series; books and manga not yet, see ADR 0035): a "Content warnings" section. Without avoid-topics it invites the user to choose some ("Show this title's warnings" looks it up anyway):
  - For each avoid-topic: **Yes / No / Unclear** based on DTDD yes/no vote counts, e.g. "Yes · 142 yes / 3 no".
  - Other topics are collapsed under "See all topics".
  - Details are **spoiler-free by default**. Comments are hidden behind a tap.
  - Credit line: "Powered by DoesTheDogDie.com" (the wording DTDD's API terms require) with a link to DTDD.
  - A "Content warning: a dog dies" note (and a "Heads up" stamp) when one of them is a Yes.
- **Collection tiles and rows, and quick-add search results:** a small warning badge when a title has a "Yes" for one of the user's avoid-topics. From cached data only: a title nobody has opened yet has no badge.
- **Survived Card:** for titles where DTDD says Yes to a fun scare (jump scares, zombies, possession, ghosts, clowns, creepy dolls, gore, spiders, snakes, sharks, needles), the finish celebration offers a Survived template ("Survived the jump scares 👻"): a stitched "I SURVIVED" patch next to the taped-in poster. No counts or timestamps: DTDD has none per scene.

## Rules
- **DTDD is called server-side only** (route handler) with `DTDD_API_KEY`. Verify endpoints, rate limits, attribution and commercial-use terms against DTDD's current API docs **before** implementation. Record the findings in [external-apis](../../architecture/external-apis.md).
- **Matching:** match a DTDD media item to our `titles` row by TMDB/IMDb id if the API returns one. Otherwise match by title + year + type, and store the matched `dtdd_id` on the title. Ambiguous matches are not shown.
- **Cache** DTDD responses in `title_warnings` with `fetched_at`. Refresh when older than 7 days on view (stale-while-revalidate). Never call DTDD from the client.
- **"Yes" rule** (config): yes votes ≥ 3 and yes > no → Yes. no ≥ 3 and no > yes → No. Otherwise Unclear.
- Put the provider behind an interface (`WarningsProvider`) so our own community data can be merged later.
- Avoid-topic settings live in our DB (`user_avoid_topics`), keyed by DTDD topic id.

## Acceptance criteria
- [x] A user who avoids "a dog dies" sees a badge on a title where DTDD shows yes, with vote counts and the DTDD credit.
- [x] A second view within 7 days makes no DTDD request (cache hit).
- [x] An unmatched title shows "No warning data yet" and no badge.
- [x] No DTDD key or request appears in client bundles or network calls from the browser.

Checked in `e2e/warnings.spec.ts` (seeded cache; the browser never requests DTDD) and by hand against the live API on 2026-09-29 (John Wick, Stranger Things, Parasite: matched by TMDB id, first lookup 1–3.5 s, then 40–160 ms from the cache).

## Data
`titles.dtdd_id` + `titles.dtdd_checked_at`, `title_warnings` (title_id, topic_id, topic_name, category, spoiler, yes_count, no_count, comment, fetched_at), `user_avoid_topics` (id, user_id, topic_id, soft delete: a user table under the day-one rules). See the [data model](../../architecture/data-model.md).
