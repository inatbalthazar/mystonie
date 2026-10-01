# ADR 0058: Look before you add: a title's details and warnings in the ➕ sheet, on request

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner (2026-10-01) asked for content warnings from the search on, and for the add step to show a title's details from IMDb and DoesTheDogDie, for people who want to look before they add.

Before this change:
- Search results got a warning badge for the viewer's avoid-topics, but only from cached DTDD data ([ADR 0035](0035-content-warnings-cache-and-survived.md)).
- Tapping a result went straight to the status buttons, with no details.
- A title's full warnings were on its page only.

Two limits shape the answer:
- **DTDD's quota.** Our share of the free tier is 25 calls a minute and 160 a day, and one lookup takes 2–3 calls. Looking up every search result (20 per search) would use the day's budget in a few searches.
- **IMDb's data isn't free to show** ([ADR 0001](0001-tmdb-instead-of-imdb.md)). Its rating and synopsis are licensed. TMDB gives us IMDb's id, so we can link to the IMDb page.

## Decision
**Search results stay cache-only.** They keep the warning badge for the viewer's avoid-topics. Every title someone opens gets looked up and cached, so badges spread with use.

**The status step (after a result is tapped)** now shows:
- **The warning note at once.** It is the search badge's words ("Content warning: a dog dies"), so it costs no request.
- **"Details and content warnings"**, a collapsed button between the title and the status buttons. Tapping it calls `GET /api/titles/preview/{kind}/{id}` (signed in, 30 a minute), which returns:
  - **About the title:**
    - TMDB's score and vote count, labelled TMDB.
    - Tagline and synopsis, cut at 1,200 characters, with "Read more" after 5 lines.
    - Genres, runtime, and seasons and episodes.
    - Directors (a series' creators) and the top-billed cast; a book's authors and a game's developers.
  - **Links:** "See it on IMDb" when TMDB knows the IMDb id, and the title's full page.
  - **Content warnings:**
    - The viewer's avoid-topics against DTDD and our own confirmed warnings (the stage 4 check, [ADR 0045](0045-pre-watch-check.md)). Without topics, an invitation to choose some.
    - DTDD's most-voted Yes topics for movies and series: up to 8, as chips with their Yes counts. Spoiler topics are left out of the chips but counted in "and N more on DoesTheDogDie".
    - "No warning data yet" for a title DTDD doesn't have. DTDD's credit and its page link.
  - TMDB's attribution.
- **Fresh data wins.** Once loaded, the details replace the badge's note, because the badge reads the cache only.
- **Why on request:** opening the details spends DTDD's quota exactly as opening the title page does: one lookup per title, then cached for 7 days. Most adds happen without it.
- **Adding stays 3 taps.** The status buttons are unchanged, just below the details.

**Series get their IMDb id.** TMDB's details request now appends `external_ids` along with `credits`, still one request. A series' IMDb id is only there; a movie's is `imdb_id`. The DTDD matcher reads either, so series match by id more often. Series cached before this change gain the id when the preview refreshes them after their week.

## Consequences
- **New code:**
  - `src/core/title-preview.ts` (`tmdbFacts`, `flaggedTopics`, `imdbUrl`, `creditNames`), with tests.
  - `src/data/titles.ts` `titleExtras`.
  - The route `src/app/api/titles/preview/[kind]/[id]/route.ts`.
  - `src/components/collection/title-details.tsx`.
  - Analytics event `title_details_opened` `{kind}`.
- **No migration.** It reads `titles.raw`, `titles.credits` and the warnings cache.
- **Not in the details:**
  - IMDb's rating and synopsis (licensed).
  - DTDD comments (they stay behind a tap on the title page).
  - The public card maker on `/`, which is signed out and so can't spend DTDD's quota.
- `e2e/warnings.spec.ts` covers:
  - the note coming along from the search badge
  - the details on a tap: score, synopsis, people, the IMDb link, the check, the chips without the spoiler, and the DTDD link
  - no DTDD request, and adding in one more tap
  - a title DTDD doesn't have
