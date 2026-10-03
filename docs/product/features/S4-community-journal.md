# S4 · Members write for the Journal

**Stage:** 4 (the owner's notes, 2026-10-03) · **Built** 2026-10-03 ([ADR 0092](../../decisions/0092-members-write-for-the-journal.md)) · Builds on [the Journal](S4-journal-reviews.md)

## Summary
Anyone with an account can write an article for the Journal: a review, a list, a guide, the story of a trip.
- It says what it's about (titles or places) and has 1 to 3 categories.
- Published, it's on the writer's page and in their followers' feeds.
- The writer can send it to be **Featured**. The Mystonie team reads it and, if they pick it, it's in everyone's Journal.

The Journal gets filters by category and kind, and a sort. Readers see what an article is about with a **Check** button.

## Behaviour
**Writing** (`/journal/write`, signed in)
- **Ways in:**
  - Write on the feed's Journal tab;
  - Write an article on Me → Journal;
  - "Write about it" under "In the Journal" on a title page (`?about=movie:603`);
  - Edit on your article (`?id=`).
- **Title** (up to 120 characters) and an optional **line under it** (up to 200). Without the line, rows show the text's opening.
- **What it's about:** up to 6 subjects.
  - **Titles** come from the catalogs' search, every kind.
  - **Places** come from the country search.
  - They show as removable chips with a poster, or a passport stamp for a place.
- **Categories:** 1 to 3 of Review, List, Opinion, Guide, Travel, On this day, Behind the scenes.
- **Text:**
  - The Journal's Markdown subset: `## heading`, `**bold**`, `*italic*`, `> quote`, `- list`.
  - Links, images and title cards stay plain text, and the hint says so.
  - Write / Preview tabs, and a character count (20,000 at most).
- **It has spoilers:** readers see a warning and "Read it anyway" first.
- **Written in:** English or Thai.
- **Send it to be Featured**, with what that means.
- **Buttons:** Publish (Update once published), Save draft (Back to drafts once published), and Delete (after a confirmation).
  - Saving a new article turns the address into its edit page.
  - Leaving with unsaved changes asks first.
- **Publishing** needs a category and at least 100 characters of text, with no more than 3 web addresses. A draft only needs a title. The errors say what's missing.
- **Under the buttons:**
  - The Terms line: you keep what you write, and Mystonie may show it.
  - A note when your page is private: only you see your articles then.

**Where it stands** (the writer sees it on the article and on Me → Journal)
- Draft · Published · Waiting for the team · Featured · Not featured · Taken down. Each comes with a line of what it means, and the team's note when there is one.
- Editing a Featured or declined article sends it back to the team: it waits again and isn't Featured meanwhile. The editor warns about this on a Featured article.
- Back to drafts takes it out of the team's queue.

**Reading** (`/journal/u/<id>`, public while it's published and the writer's page is public)
- **The article:**
  - the Featured stamp and the categories (links to the Journal filtered by them);
  - the title, the line under it, and the byline (photo, name, link to the writer's page);
  - the date, reading time and "Spoilers".
- **What it's about:** taped-in posters and passport stamps in a row that swipes sideways, each with **Check**:
  - **A title:** quick add opens on it, with its details, warnings and Add, as a Trending poster does. Visitors sign in first.
  - **A place:** its sheet opens on the Atlas.
- **Then** the text, behind the spoiler warning when there is one, Stamp, Save and Share (visitors sign in first), and **Report**.
- **Search engines:** only Featured articles are indexed (with Article data and in the sitemap).

**In the Journal** (the feed's Journal tab)
- **What's in it:** the team's articles, Featured members' articles, articles by the people you follow, and your own. Members' articles show in your language or English.
- **Categories:** All, Review, List… as a row of chips that swipes sideways.
- **About** (All kinds, Movies, Series, Books, Manga, Games, Places) and **Sort** (For you when signed in, Newest, Most stamped) are pickers beside Write.
- The filters live in the address. With nothing matching: "No articles like that yet." and "Show every article".
- **Rows** show the first category, "Spoilers", and a passport stamp for an article about places only.
- **Following feed:** articles by the people you follow show among the finishes at the time they were published, with the Journal's newest.
- **Title pages:** "In the Journal" lists the team's and Featured members' articles about the title (3 at most), then "Write about it".

**Profiles**
- Someone's profile has a **Journal** tab (`/u/<username>/journal`) once they published an article: their articles as rows, newest first.
- Me has **Album · Stats · Cards · Journal**.

**The team** (`/admin/journal`)
- **Access:**
  - Only accounts signed in with an address in `ADMIN_EMAILS`. Anyone else gets a 404.
  - "Journal review (team)" in Settings → About Mystonie, for those accounts only.
- **Sent to be Featured** (oldest first): each article's title, writer, categories and text to read in place.
  - Feature it, Not this time, or Take down, with an optional note to the writer.
  - The team's inbox gets an email when an article is sent.
- **Reported:** published articles with open reports, with the reasons. Take down (resolves the reports) or Put back.

## Acceptance criteria
- [x] A writer saves drafts and publishes. Only they see drafts; a published article is public while their page is public and unblocked. (`stage4_community_journal.test.sql`, `e2e/journal-write.spec.ts`)
- [x] Only the team approves or declines. An edited Featured article waits again, and the database keeps the first publication's time. (`stage4_community_journal.test.sql`, `e2e/journal-write.spec.ts`)
- [x] A writer's text never renders links, images or title cards. Publishing needs a category, enough text and few web addresses. (`src/core/journal-posts.test.ts`)
- [x] Everyone's Journal has team, Featured, followed and own articles, and filters by category and kind and sorts. (`journal-posts.test.ts`, `e2e/journal-write.spec.ts`)
- [x] Check opens quick add on a title, and the Atlas on a place. (`e2e/journal-write.spec.ts`)
- [x] The admin page is the team's only, with the queue and reports. (`e2e/journal-write.spec.ts`; the admin test runs with `ADMIN_EMAILS` set)
- [x] Report on articles; daily caps; soft delete. (`stage4_community_journal.test.sql`)
- [x] Mobile-first at 360px, dark mode checked (Journal tab, article, editor, Me → Journal, profile Journal, admin).

## Data
- **`journal_posts`**:
  - the article: `locale`, `title`, `description`, `body`, with `excerpt` and `minutes` worked out on save;
  - `tags`, `subjects` (`movie:603`, `place:JP`) and `spoilers`;
  - `published_at`, `feature_request` / `featured_at` / `review_note`, `hidden_at`;
  - day-one rules.
- **`journal_bylines(uuid[])`:** the bylines of public writers.
- **`reports.target_kind`:** `article` allowed.
- The migration is `20261024090000_stage4_community_journal.sql` (see the [data model](../../architecture/data-model.md)).
- Stamps and Saves reuse `journal_marks` by the article's id.

## Events
`article_stamped`, `article_saved` and `article_shared` as for team articles, with `place: "profile"` on a profile's Journal tab.
