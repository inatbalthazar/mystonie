# S4 · The Journal and "What people said"

**Stage:** 4 (the owner's question, 2026-10-01) · **Built** 2026-10-01 ([ADR 0051](../../decisions/0051-journal-and-title-reviews.md); the Journal as a feed, [ADR 0052](../../decisions/0052-journal-feed.md))

## Summary
Two ways to read about what to finish next. **The Journal** is articles written by the Mystonie team, with title cards anyone can add from, listed in the feed ([ADR 0062](../../decisions/0062-journal-in-the-feed.md)): its Articles tab (For you first) and Saved, with Stamps, Saves and Share, and the newest articles among Following. **"What people said"** puts the short reviews people write when they finish a title on that title's page. Members write articles for it too, and the team features the best ([S4 members write for the Journal](S4-community-journal.md), [ADR 0092](../../decisions/0092-members-write-for-the-journal.md)); comments wait ([later/long-reviews.md](../later/long-reviews.md)).

## Behaviour
**The Journal**
- **`/journal`**, public, a feed of rows (Medium-style, in the album's paper): the byline (the writer's photo, else their initial, or Stonie for the team; their name, linking to their Mystonie page when the article names one), the title and description with a small taped polaroid beside them (the cover, else the poster of the first title the article shows), a "Featured" stamp, the date, reading time, "In English" when the reader's language is missing, then Stamp (with how many), Save and Share. The whole row opens the article. Empty: "The first article is on its way."
- **In the feed's tabs** (the album's dividers, links `?tab=`, [ADR 0062](../../decisions/0062-journal-in-the-feed.md)): **Following** (signed in, first: the newest articles among the finishes), **Articles** (every article; signed in, For you: articles about the titles in your collection first, then ones whose genres and kinds match what you collect lately, then newer ones; the reason in coral handwriting, e.g. "You want to watch The Matrix"; with an empty collection, newest first and the hint "As your collection grows…"; visitors get them newest first) and **Saved** (once you saved one, last saved first). Visitors only get Articles, so no tab bar. `/journal` redirects to Articles (Saved to Saved). Featured articles keep their stamp; there's no Featured tab.
- **Stamp, Save, Share:** a Stamp is kudos on an article; its count is public (who stamped isn't). Save keeps it to read later: on the Saved tab and on Me ("Saved to read", the latest three and "See all"). Share opens the phone's share sheet, else copies the link ("Link copied"). Visitors' Stamp and Save lead to sign in and back.
- **In the Following feed:** the newest six articles sit among the finishes by their date, as taped cards headed "From the Journal" (with the reason when one of your titles is in it); a new one tops that day's finishes. When the feed ends, up to three older ones follow; a new account's empty feed shows the newest three.
- **`/journal/<slug>`**, public: back link, title, description, byline ("By Stonie" with the photo, or "The Mystonie team" with Stonie), date and reading time, the cover, then the text, and under it "Enjoyed this one?" with Stamp (and how many), Save and Share (the page is static; these load once it's open). Headings, lists, quotes in handwriting, photos with handwritten captions, links (ours open in place, others in a new tab) and **title cards**: poster, name, kind and year, and a coral **Add** that opens quick add on the title (sign-in first for visitors).
- **Languages:** written per language (`en.md`, `th.md`). A Thai reader gets the Thai version, or the English one with a note ("This article isn't in your language yet…").
- **Drafts** show only on development and previews, marked "Draft".
- **Linked from** the footer of every page, the Feed's tabs (where the nav island keeps Feed lit, [ADR 0053](../../decisions/0053-feed-tab-stats-in-me.md)), a Home note for the newest article in its first 45 days, "In the Journal" on the page of each title an article shows (up to 3), and the sitemap.
- **Writing:** see [content/journal/README.md](../../../content/journal/README.md).

**What people said** (every title page)
- The reviews written when finishing this title: yours and those of public people who haven't blocked you (and you them), newest first, at most 50.
- Each one: avatar and name (linking to their page), "finished 2 days ago", the stars, the review in handwriting, and the Stamp (your own shows its count).
- Three at first, then "Show all (N)". Nothing shows until someone has written a review.

## Acceptance criteria
- [x] An article file becomes a public, static page; a mistake in it fails the build with its path. (`src/core/journal.test.ts`)
- [x] No HTML from a file reaches the page; links and images are checked. (`journal.test.ts`)
- [x] Title cards show the cached title and Add opens quick add on it. (`e2e/journal.spec.ts`)
- [x] The reader's language, else English with a note; `hreflang` and the sitemap list only written languages. (`journal.test.ts`, `e2e/journal.spec.ts`)
- [x] Drafts never show in production.
- [x] Reviews on title pages: own and public, never private or blocked, newest first, three then Show all. (`stage4_title_reviews.test.sql`, `e2e/journal.spec.ts`)
- [x] Mobile-first at 360px, dark mode checked.
- [x] The Journal in the feed: rows, tabs (Following only signed in, Saved only when there's something), For you ranks the Articles tab by the collection with a reason, `/journal` redirects. (`src/core/journal-feed.test.ts`, `e2e/journal.spec.ts`)
- [x] Stamps and Saves on articles: yours only, counts public, Saved on the tab and Me, visitors sent to sign in. (`stage4_journal_marks.test.sql`, `e2e/journal.spec.ts`)
- [x] The newest articles in the Following feed by date, and in a new account's empty feed. (`journal-feed.test.ts`, `e2e/journal.spec.ts`)

## Data
Articles are files (`content/journal/`). Stamps and Saves on them: `journal_marks` and `journal_stamp_counts()`, migration `20261012090000_stage4_journal_marks.sql`. `title_reviews(p_title_id, p_limit)` and the index `entries_title_reviews`, migration `20261011090000_stage4_title_reviews.sql` (see the [data model](../../architecture/data-model.md)). Both migrations must be on the remote project before this code deploys.

## Events
`article_stamped`, `article_saved` and `article_shared` (`channel`: share sheet or copy), each with `place`: the Journal, the article or the Following feed. Adds from a title card count as `title_added` like any quick add.
