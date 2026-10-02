# The Journal

Articles for [mystonie.com/journal](../../src/app/[locale]/journal/page.tsx), written by the Mystonie team ([ADR 0051](../../docs/decisions/0051-journal-and-title-reviews.md)). Readers get them as a feed: For you (articles about the titles in their collection first), Latest, Featured and Saved, with Stamps, Saves and Share; the newest six also show in everyone's Following feed on their date ([ADR 0052](../../docs/decisions/0052-journal-feed.md)).

## Add an article
1. Make a folder named like the URL: `content/journal/ten-shows-for-a-weekend/` (lowercase letters, numbers and dashes).
2. Put the English version in `en.md`. A Thai version goes in `th.md` next to it; it's optional, and Thai readers get the English one until it's there (with a note).
3. Start with `draft: true`. Drafts show on `pnpm dev` and Vercel previews, never on the live site. Change it to `false` (or delete the line) to publish, then commit and deploy.
4. Images go in `public/journal/` and are linked as `/journal/your-image.jpg`.

A mistake in a file (missing title, a bad date, a broken title card) stops the build and names the file, so nothing broken goes live.

## The top of every file
```
---
title: Ten shows you can finish in a weekend
description: One line for the list and for link previews.
date: 2026-10-01
cover: /journal/weekend.jpg      # optional: on top, in link previews and in the feed's row
author: Your name                # optional, "The Mystonie team" (with Stonie) by default
avatar: /journal/authors/me.jpg  # optional: your photo for the byline, else your initial
profile: your_username           # optional: your Mystonie username, the byline links to your page
featured: true                   # optional: on the Featured tab, a little higher in For you
draft: true                      # optional
---
```

Anything after ` #` on a line is a note to yourself and is dropped, so a title with a `#` in it goes in quotes: `title: "Top 10 #1 picks"`. Without a cover, the feed shows the poster of the first title in the article.

## What you can write
| Write | Get |
|---|---|
| `## Heading`, `### Smaller heading` | headings |
| A blank line between paragraphs | paragraphs |
| `**bold**`, `*italic*`, `` `code` `` | bold, italic, code |
| `[text](/reel)` or `[text](https://…)` | a link (our pages open in place, others in a new tab) |
| `- item` or `1. item` | lists |
| `> a line` | a handwritten quote |
| `---` | a dashed divider |
| `![caption](/journal/photo.jpg)` | a photo with a handwritten caption |
| `@[movie:603](The Matrix)` on its own line | the title as a card with **Add** (opens quick add on it) |

Title cards: the kind is `movie`, `series`, `book`, `manga` or `game`, and the id is the one in the title's URL on Mystonie (`/title/movie/603` → `@[movie:603]`). The name in brackets is only used if the catalog can't be reached. An article with a title card also shows under "In the Journal" on that title's page.

`content/journal/how-to-write/` is a draft that uses all of this; copy it to start.
