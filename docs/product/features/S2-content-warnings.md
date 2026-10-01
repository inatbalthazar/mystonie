# S2 · Content warnings (from the DoesTheDogDie API)

**Stage:** 2 (first item) · **Built** 2026-09-29 ([ADR 0035](../../decisions/0035-content-warnings-cache-and-survived.md)) · Our own warnings with timestamps and the quiz: [S3 warnings & quiz](S3-warnings-quiz.md) (stage 3) · Decision: [ADR 0009](../../decisions/0009-content-warnings-from-dtdd-first.md)

## Summary
Users pick the topics they want to avoid (e.g. *a dog dies*, *jump scares*, *sexual content*, *flashing lights*, *spiders*). Title pages and cards then show warnings for those topics, using the existing community data from **DoesTheDogDie (DTDD)**.

**The goal is a check before you watch** ("is this safe to watch with my family?"), not a note after it. Since stage 4 ([ADR 0045](../../decisions/0045-pre-watch-check.md)) every title page answers that first.

## Pre-watch check (stage 4, built 2026-09-30)
- **Top of every title page** (all kinds), right under the header: "Before you watch" ("Before you read", "Before you play").
  - **Hits:** "2 of your topics: a dog dies and jump scares", each with its source ("DoesTheDogDie: 142 yes · 3 no", "Confirmed on Mystonie") and a link to the details below.
  - **Clear:** DTDD knows the title and nothing hits: "Nothing from your avoid list", then how sure ("People said no to 3 of your 5 topics; the rest don't have enough votes yet").
  - **Unknown:** no DTDD data and none of our own warnings: "No answer for your topics yet" (books, manga and games say their warnings come from people on Mystonie).
  - Sources: DTDD's votes (the Yes rule below) and our own confirmed scene warnings and quiz "yes" answers ([S3 warnings & quiz](S3-warnings-quiz.md)).
- **No topics chosen:** "Safe to watch with your family?" with **Check for family viewing**: one tap saves the family set (12 of our own topics: animal deaths, jump scares, gore, violence, sexual assault, suicide, self-harm, child abuse, sex scenes, drug use), editable in Settings, which also offers "Use the family set" while nothing is chosen. Or "Choose my own topics".
- **Opened from search:** the title page looks the title up on DTDD (one request, then cached), so every title someone opens gets checked. Search results themselves stay cache-only (quota).
- **Look before you add** (stage 4, [ADR 0058](../../decisions/0058-look-before-you-add.md)): in the ➕ sheet, a tapped result's status step shows the search badge's warning note at once, and "Details and content warnings" (one tap, loaded on request): TMDB's score, synopsis, people and genres, an IMDb link, the viewer's check, and DTDD's most-voted Yes topics (spoilers left out, only counted). It looks the title up like opening its page; adding stays 3 taps.
- **Want to watch:** a check sticker ("Checked: nothing from your avoid list") on Want posters DTDD knows with no badge; the warning badge as before otherwise.

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

Pre-watch check (stage 4):
- [x] A title page answers on top: the avoided topics it has with their sources, or "Nothing from your avoid list" with how sure, or "No answer for your topics yet". (`titleCheck` in `src/core/warnings.test.ts`; `e2e/warnings.spec.ts`)
- [x] Someone with no topics checks a title in one tap ("Check for family viewing"), on every kind.
- [x] A Want-to-watch poster shows the check (a warning badge or a check sticker) when the title was checked; no DTDD request comes from search or the collection.
- [x] In the ➕ sheet, a picked title shows its warning note, and on a tap its details (TMDB score, synopsis, people, IMDb link) and warnings (the check, DTDD's Yes topics without spoilers); adding is still one tap away. (`src/core/title-preview.test.ts`; `e2e/warnings.spec.ts`)

Checked in `e2e/warnings.spec.ts` (seeded cache; the browser never requests DTDD) and by hand against the live API on 2026-09-29 (John Wick, Stranger Things, Parasite: matched by TMDB id, first lookup 1–3.5 s, then 40–160 ms from the cache).

## Data
`titles.dtdd_id` + `titles.dtdd_checked_at`, `title_warnings` (title_id, topic_id, topic_name, category, spoiler, yes_count, no_count, comment, fetched_at), `user_avoid_topics` (id, user_id, topic_id, soft delete: a user table under the day-one rules). See the [data model](../../architecture/data-model.md).
