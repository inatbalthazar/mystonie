# ADR 0051: The Journal (the team's articles as Markdown in the repo) and "What people said" on title pages

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner (2026-10-01) asked whether Mystonie should have a blog or review feed by users, which they would write themselves at first. A user blog on day one would look empty, adds moderation (spam, spoilers, copyright) that a solo founder can't carry, and pulls the product towards Letterboxd's long reviews and away from "Strava for what you finish". But two parts are worth having before launch:
1. **Articles by the team:** something to read on day one, public pages search engines can find (title pages are signed in and noindex), and a voice for the brand.
2. **The short reviews people already write:** every finish can carry a rating and a review of up to 280 characters (`entries.review`). They only showed in the Following feed.

The owner agreed (2026-10-01), and agreed that articles are per language, English first.

## Decision
**The Journal** (`/journal`, `/journal/<slug>`): the team's articles, public, static and indexed.
- Each article is a folder in `content/journal/<slug>/` with `en.md` and optionally `th.md`: a few frontmatter lines (`title`, `description`, `date`, optional `cover`, `author`, `draft`) and a small Markdown subset. The owner writes a file, commits and deploys. `content/journal/README.md` is the how-to.
- **Our own parser** (`src/core/journal.ts`, pure TypeScript with tests) instead of a Markdown or MDX package: headings, paragraphs, bold, italic, code, links, lists, quotes, dividers, images and **title cards** (`@[movie:603](The Matrix)` on its own line). It returns blocks that React renders, so no HTML from a file reaches the page, and links and images are checked (our own paths, https, mailto; images only from `public/journal/` or https). A file with a mistake fails the build and names the file.
- **Title cards** show the title from our catalog cache (`ensureTitle`, refreshed daily: `revalidate`) with **Add**, which opens quick add on it (`/collection?add=1&pick=…`, through sign-in for visitors). The label in brackets stands in when the catalog can't be reached.
- **Languages:** a reader gets the article in their language when it's written, else the English one, with a note and `lang="en"` on it. The list shows each article once, in the reader's language when it can. `hreflang` alternates and the sitemap list only the languages an article is written in. A fallback page's canonical points to the original.
- **Drafts** (`draft: true`) show only outside production (`pnpm dev`, Vercel previews), marked "Draft" and noindex.
- **Where it shows:** a "Journal" link in the footer of every page, a note on Home for the newest article in its first 45 days, "In the Journal" on the page of every title an article shows as a card, the sitemap, and article metadata for search engines (`Article` JSON-LD, Open Graph).

**"What people said"** on every title page (movies, series, books, manga, games): the reviews written when finishing the title, by you and by public, unblocked people, newest first (`title_reviews(p_title_id, p_limit)`, security definer, signed in only, at most 50). Each shows the person, when, the rating, the review and the Stamp. Three show at first, then "Show all". It shows only once someone has written one. Nothing new is stored: the function shows only what entries' RLS already shows. Reports stay on profiles and cards.

Rejected:
- **A user blog or long reviews now.** It's in [later/long-reviews.md](../product/later/long-reviews.md), with its gate.
- **A CMS or a `posts` table with an editor.** It's more to build and secure, and a database copy of what a text file does. One writer doesn't need it.
- **MDX or a Markdown package.** It's a new dependency, and MDX runs code from content. The subset is about 250 lines with tests.
- **Machine-translating articles.** A real Thai version or the English one with a note is more honest.

## Consequences
- Migration `20261011090000_stage4_title_reviews.sql` (the function and the partial index `entries_title_reviews`) must go on the remote project before the next deploy, with the other stage 4 migrations.
- Publishing an article is a commit and a deploy. That's fine while the owner is the only writer.
- Signed-out visitors who tap Add go through sign-in and land in quick add on the title: the Journal is also a way in.
- `e2e/journal.spec.ts` reads the draft `content/journal/how-to-write/`; keep it (it is never published) or change the test with it.
