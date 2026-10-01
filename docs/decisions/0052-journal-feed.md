# ADR 0052: The Journal as a feed (For you from the collection, Stamps and Saves on articles, articles in the Following feed)

**Status:** Accepted · **Date:** 2026-10-01

> The Journal's own page and its tabs were folded into the feed in [ADR 0062](0062-journal-in-the-feed.md); `/journal` now redirects there.

## Context
The owner (2026-10-01) showed Medium's home ("For you" / "Featured", rows with a byline, a title, a subtitle and a thumbnail, claps and saves) as what the Journal ([ADR 0051](0051-journal-and-title-reviews.md)) should feel like: a feed that puts articles in front of people, not a page they have to find in the footer. They agreed to the first two steps of the proposal: rows and tabs, Share and articles in the Following feed; then Stamps and Saves on articles. Sponsored articles (a cinema paying for articles) are dropped for now: the Journal has only the owner's own content and no ads (the owner, 2026-10-01).

## Decision
**Rows instead of cards.** `/journal` lists articles as feed rows in the album's paper: the byline (photo, name, link to the writer's page), the title and description with the picture as a small taped polaroid beside them (the cover, else the poster of the first title the article shows), a "Featured" stamp, the date, reading time, Stamp (with its count), Save and Share. The whole row opens the article; the byline and buttons sit above that link.

**Tabs as links** (`?tab=`, like Stats and the board), so each is a plain server render: **For you** (signed in, the default), **Latest** (the default for visitors and search engines; `/journal` stays the canonical URL), **Featured** (frontmatter `featured: true`; the tab shows once something is featured) and **Saved** (once you saved something). `/journal` becomes dynamic (it reads the session); article pages stay static.

**For you is our collection, not a recommender.** `rankForYou` (pure TS, `src/core/journal-feed.ts`) scores each article: titles it shows that are in your collection count most (want 3, in progress 2.5, finished 1.5, at most 6), then how well its titles' genres (×2) and kinds (×1.5) match your latest 300 entries, then freshness (2, halving every three weeks), plus 0.5 when featured. With an empty collection it's newest first, with a hint. The strongest match is shown as the reason ("You want to watch The Matrix"), in handwriting.

**Stamps and Saves** live in one table, `journal_marks` (`kind` = `stamp` | `save`), under the day-one rules, like stamps on finishes. Articles are files, so a mark names its slug and the route (`POST /api/journal/marks`) only takes published ones. **Stamp counts are public** on articles (`journal_stamp_counts()`, also for visitors), unlike finishes, where only the owner sees theirs: an article isn't a person to compare, and the count tells readers what others liked. Who stamped stays private. Saved articles are on the Saved tab and on Me ("Saved to read", owner only). Visitors' Stamp and Save are links to sign in and back.

**Article pages stay static.** Their Stamp, Save and Share bar loads the count and the reader's own marks after the page opens (`GET /api/journal/marks?slug=`), with the signed-in hint from the pre-paint script until then.

**Share** uses the phone's share sheet, else copies the link (`?ref=journal`, so sign-ups from shared articles show in analytics).

**Articles in the Following feed, by date.** The newest 6 articles are placed among the finishes like posts from an account everyone follows (`interleaveArticles`): each at the end of its day (UTC), so a new one tops that day's finishes, only among the pages loaded; once there are no more pages, up to 3 older ones follow the last finish, so a new account's empty feed still has something to read. Club feeds don't get articles.

**Writers.** Frontmatter gains `avatar` (a photo under `/journal/` or https) and `profile` (a Mystonie username: the byline links to it, and `Article` JSON-LD gets the author's URL). No avatar: the writer's initial, or Stonie for the team. A `# comment` after a frontmatter value is now dropped, as in YAML (the README's example has them).

Rejected:
- **An article every 8 posts** (the first proposal). Fixed slots show the same top article in the same place on every visit, or need read tracking to rotate; by date, a new article is at the top on its day and sinks like any post, with nothing stored.
- **Static `/journal` with For you loaded in the browser.** The order would jump after the page shows; the list is cheap to render per request.
- **Client-side tabs.** Instant, but needs every list in the page and the rows as client state; links match Stats and the board and work without JavaScript.
- **Two tables (stamps, saves).** The same columns and rules twice.
- **Read tracking** (to hide read articles). Not needed with date order, and it's more personal data to keep.
- **Comments on articles.** Moderation (spam, spoilers) a solo founder can't carry yet; they wait with long reviews ([later/long-reviews.md](../product/later/long-reviews.md)).
- **Sponsored articles.** Not now: content only, no ads (the owner, 2026-10-01). If it ever comes, it follows [native ads](../product/later/native-ads.md) (labelled "Sponsored", `rel="sponsored"`, never in the logging flow) and the commercial-use gates of [ADR 0049](0049-revenue-plan.md).

## Consequences
- Migration `20261012090000_stage4_journal_marks.sql` must go on the remote project before the next deploy, with the other stage 4 migrations.
- `/journal` costs a function call per view (it was static). Its queries run in parallel and a database problem leaves plain rows.
- New events: `article_stamped`, `article_saved`, `article_shared` (`place`: journal, article or feed).
- The privacy policy says what's kept: the articles you Stamp or save, visible only to you; the counts are public.
- `e2e/journal.spec.ts` uses the draft `content/journal/how-to-write/`, now featured; the social test scopes its Stamp to the finish, since the feed also holds articles.
