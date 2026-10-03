# ADR 0092: Members write for the Journal, the team features the best

**Status:** Accepted · **Date:** 2026-10-03 · Extends [ADR 0051](0051-journal-and-title-reviews.md), [ADR 0052](0052-journal-feed.md) and [ADR 0062](0062-journal-in-the-feed.md); builds part of [later/long-reviews.md](../product/later/long-reviews.md) on the owner's go

## Context
Until now only the team wrote the Journal, as Markdown files in the repo. On 2026-10-03 the owner asked for a real Journal (notes at the end of the [brief](../brief.th.md)):
- members write reviews and other articles there, and see their own;
- a writer can tick "send it to be Featured", and the owner approves it from a back office;
- the Journal gets category filters and a sort;
- the writer picks categories and what the article is about: a movie, series, book, manga, game or place;
- readers see the picture and name of what it's about, with a **Check** button that opens it like a poster in Trending this week.

[later/long-reviews.md](../product/later/long-reviews.md) had held this back for moderation. A solo founder can't read everything members publish.

## Decision
**Articles are rows.** `journal_posts` holds members' articles; the team's stay files.
- An article is named by its id (UUID v7). That id fits `journal_marks`' slug check, so Stamps, Saves and their counts work as they are.
- A member's article lives at `/journal/u/<id>`. It's rendered per request, so the team's articles stay static at `/journal/<slug>`, and `u` and `write` are reserved folder names.

**Who sees what.** This keeps what reaches everyone in the team's hands:
- A **draft** is its writer's only.
- A **published** article is on the writer's page (a new Journal tab on profiles and on Me) and in their followers' Following feed, while their page is public and there's no block. These pages stay out of search engines.
- Everyone's **Journal** (the feed's Journal tab, title pages' "In the Journal", the sitemap) has the team's articles, **Featured** members' articles, and those by people the reader follows. Members' articles show in the reader's language or English.

**Featured, the team's call.**
- The writer can only send an article to be Featured, or take that back: `feature_request` = `pending` or null.
- `approved` (with `featured_at`) and `declined` (with an optional note to the writer) come from the team, through the service role.
- A database trigger enforces this. It also sends a Featured or declined article back to `pending` when its text changes, so nothing edited after the review stays Featured.
- The database stamps `published_at` once.
- The trigger caps writers at 10 new articles a day and 500 live ones.

**The back office.** It's `/admin/journal`, linked from Settings for team accounts only.
- An account signed in with an address in `ADMIN_EMAILS` (comma separated, not secret) is the team. There's no admin account, role or table.
- The page lists articles sent to be Featured (oldest first) and reported ones, each with its text to read in place.
- Its buttons are Feature it, Not this time (with a note) and Take down / Put back (`hidden_at`), through `POST /api/admin/journal`.
- A newly sent article emails the team's inbox, like a report.

**Writing.** `/journal/write` has:
- a title, an optional line under it, and what it's about (up to 6 titles from the catalogs' search, or countries);
- 1 to 3 categories, and the text in the team's Markdown subset with a live preview;
- "It has spoilers" (readers see a warning first), the language, and "Send it to be Featured".

A writer's text has **no links, images or title cards**. `parseWriterBody` leaves them as text, which takes the point out of spam. Publishing also asks for at least 100 characters and no more than 3 web addresses. The titles it's about are cached when it's saved, so their posters always show.

**Categories, filters and sort.**
- Seven categories: Review, List, Opinion, Guide, Travel, On this day, Behind the scenes. Team articles get them with `tags:` in their frontmatter.
- The Journal tab filters by category (chips) and by what articles are about (Movies… Places), and sorts by For you (signed in), Newest or Most stamped. It's all in the address.

**Check.**
- On a title, Check opens quick add on it, as Trending's posters do: details, warnings, Add. Visitors sign in first, as with title cards.
- On a place, Check opens its sheet on the Atlas (`?country=`).
- A place has no poster, so it's drawn as a passport stamp.

**Also:**
- Report works on articles (`reports.target_kind` = `article`).
- Members' published articles count toward the Byline sticker.
- The Terms and Privacy say who sees what, and that writers keep their text.

**Rejected:**
- **Every published article in everyone's Journal:** the storefront (and search engines) would carry whatever anyone writes, which is the moderation load long-reviews.md warned about.
- **An admin role in the database:** the owner would have to run SQL on production to become an admin. An env var of addresses is one line in Vercel, and the service role already does the writing.
- **Full Markdown with links and images for members:** links invite spam, and images need storage and moderation.
- **Members' articles at `/journal/<id>` like the team's:** that would make the team's static pages dynamic, or members' cached for a day, private ones included.

## Consequences
- 🧑 Before deploying: apply `20261024090000_stage4_community_journal.sql` to the remote project, set `ADMIN_EMAILS` in Vercel, and run `get_advisors`.
- A Featured article's edit takes it out of Featured until the team reads it again. The editor says so.
- The Following feed keeps the newest six Journal articles of all kinds, so busy weeks of Featured articles push older team articles down.
- Comments and a review feed of everyone's writing are still in [later/long-reviews.md](../product/later/long-reviews.md).
