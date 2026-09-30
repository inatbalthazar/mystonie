# ADR 0035: Content warnings: one cached row per voted topic, badges from the cache only, a shared DTDD budget, Survived as a template

**Status:** Accepted · **Date:** 2026-09-29

## Context
The stage 2 task "DTDD provider + matching + cache, avoid-topics settings, warning block + badges, Survived card" ([S2 content warnings](../product/features/S2-content-warnings.md), [ADR 0009](0009-content-warnings-from-dtdd-first.md)) shows DoesTheDogDie's community votes for the topics each user wants to avoid.

What the build found (DTDD API, 2026-09-29):
- `GET /dddsearch?q=` returns items with `tmdbid`, `imdbId`, `releaseYear` and a type (Movie, TV Show, Book, …), so most titles match by id.
- `GET /media/{id}` returns every topic's `yesSum`/`noSum` for the item, the topic's category and spoiler flag, and a top comment. It is **~1.5 MB** for a popular title, and takes about 2 seconds.
- `GET /categories` returns all ~290 topics (~470 KB).
- The free tier allows 30 requests a minute and 5,000 a month, and is for non-commercial use only. Caching is allowed only to improve performance, with a refresh at least every 30 days.
- Node's `fetch` gets through DTDD's Cloudflare with the key; a request without the key gets 403.

## Decision
**Cache: `title_warnings`, one row per topic anyone voted on** (title, topic, name, category, spoiler flag, yes, no, top comment, `fetched_at`).
- Also `titles.dtdd_id` (the matched item) and `titles.dtdd_checked_at` (when we last looked, matched or not), as the spec's data section suggests.
- A lookup (`src/data/warnings.ts`) uses the cache when it is under 7 days old. An older cache is shown and refreshed after the response (`after()`, stale-while-revalidate). A title never looked up is fetched synchronously inside the block's Suspense.
- A refresh upserts the new rows and deletes the older ones, so the block is never empty mid-refresh. "Checked, no match" is a `dtdd_checked_at` with a null `dtdd_id`, also kept for 7 days, so an unmatched title doesn't spend quota on every view.
- Rejected: one jsonb row per title (as `title_providers`). Badges need "which of these titles has a Yes for one of my topics", which rows answer with one indexed query (`avoid_warnings`).
- Rejected: storing topics without votes. They say nothing, and a popular title would carry ~280 rows instead of the ones with votes.

**Matching** (`matchDtddItem` in `src/core/catalog/dtdd.ts`):
- Same type (movie ↔ Movie, series ↔ TV Show), then TMDB id, then IMDb id (from TMDB's `imdb_id` in `titles.raw`).
- Else the only item of the same type and year whose normalized name matches our name or original name, and that has no TMDB id of its own. Anything ambiguous is no match.
- The original name is searched only when the English name found nothing.
- Books and manga are left out for now: they have no shared id with DTDD, and a name-only match is too risky for this data.

**Who calls DTDD:**
- Only two server paths look a title up: the title page block, and `GET /api/warnings/{movie|series}/{id}` (signed in; a finish celebration asks it for the Survived offer).
- Badges (collection tiles and rows, quick-add search results) read the cache only. A title nobody has opened has no badge yet.
- Every DTDD call first takes a slot from a shared budget in `rate_limits`: 25 a minute and 160 a day (~5,000 a month). When the budget is used up, the lookup fails like an outage: the cache is shown if there is one, else "Couldn't load content warnings".
- Rejected: looking up every search result or collection title. That spends the monthly quota in days.

**Avoid-topics:** `user_avoid_topics`, a user table under the day-one rules like `entries` ([ADR 0021](0021-collection-tables-rules-in-the-database.md)).
- Ids are UUID v7, `updated_at` is stamped by the server, and unticking a topic sets `deleted_at` (clients have no DELETE, and may update only `deleted_at`). A topic is live once per user (partial unique index), at most 500 live (trigger). The route makes the ids with `uuidv7()`.
- Rejected: hard-deleted rows keyed by (user, topic), as for `push_subscriptions`. Those are device tokens; avoid-topics are the user's own choices, which [offline sync](../architecture/offline-sync.md) will sync, and syncing needs the tombstones.
- It is private: which topics someone avoids can reveal a lot about them. Only the owner reads it (no public-profile policy), and it is not a `profiles` column (public profile pages read profiles).
- Settings → Content warnings (`/settings/warnings`) replaces the whole set with `PUT /api/warnings/topics`, debounced, and saved on leaving the page.
- The topic list is `/categories` in Next's fetch cache for a week.

**Title page:**
- Without avoid-topics there is no lookup. Instead the block invites the user to choose topics, with a link that checks the title anyway (`?warnings=1`).
- With avoid-topics: a "Content warning: …" note for each Yes (the badge, with a "Heads up" stamp), then each chosen topic with Yes / No / Unclear and the counts ("1,374 yes · 131 no").
- Every other topic is folded under "See all topics", grouped by verdict.
- Spoiler topics hide their answer and comments hide behind a tap.
- The credit reads "Powered by DoesTheDogDie.com" (the wording DTDD's terms require), linked, with a link to the title's DTDD page.

**Survived card:** a template (`survived`: finish, movies and series) with `survived: true` in its metadata, plus `CardData.survived`.
- The card data holds one of 11 fun scares with DTDD topic ids (jump scares, zombies, possession, ghosts, clowns, dolls, gore, spiders, snakes, sharks, needles; the first with a Yes wins).
- `templatesFor` lists the template only when there is a scare. The celebration then shows an offer ("You made it through the jump scares. Make it a Survived card") rather than switching styles by itself.
- `POST /api/cards` accepts `survived` only on a finish drawn with that template, and that template only with `survived`.
- Rejected: a "SURVIVED" headline on every template. It would touch 10 templates, and the spec asks for a template.
- Dark or sad topics (a dog dies, the ending is sad) are never scares to "survive".

## Consequences
- The remote project needs `20261001090000_stage2_content_warnings.sql` (after the earlier stage 2 migrations).
- **The free DTDD tier is non-commercial.** The DTDD Commercial tier is part of the Pro go-live owner task. If we stop using DTDD, `title_warnings` must be emptied (`truncate public.title_warnings; update titles set dtdd_id = null, dtdd_checked_at = null;`).
- The DTDD budget is shared by all users. At heavy use, new titles show "Couldn't load" until the minute or day window resets. Raise the numbers with the paid tier.
- Our own community warnings ([later](../product/later/crowdsourced-warnings.md)) can plug in behind `WarningsProvider`.
