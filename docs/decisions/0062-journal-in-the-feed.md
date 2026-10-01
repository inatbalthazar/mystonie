# ADR 0062: The Journal's list moves into the feed

**Status:** Accepted · **Date:** 2026-10-01 · Changes [ADR 0052](0052-journal-feed.md) (the Journal's own page and tabs) and [ADR 0053](0053-feed-tab-stats-in-me.md) (the Journal among the feed's community tabs)

## Context
The owner saw the feed and the Journal as two pages doing the same thing: the feed already carried the newest articles among the finishes ([ADR 0052](0052-journal-feed.md)), and `/journal` was a second feed of the same articles, with its own tabs, reached from a chip on the feed and from the footer. They asked for one page, the feed, and for no Journal link in the footer.

We chose between:
- **Drop `/journal` and keep only the newest articles in the feed:** simplest, but older articles and Saved would have no list, and visitors and search engines would lose the public list.
- **The feed with tabs:** Following (as before), Articles (every article, For you first) and Saved. The feed opens to visitors, showing them the articles.

## Decision
**One page, `/feed`, with divider tabs as links (`?tab=`):**
- **Following** (signed in, the default): unchanged. Your people's finishes and yours, the newest articles among them by date, "Lately" above them.
- **Articles:** every article. Signed in, For you orders them by your collection and says why. Visitors get them newest first.
- **Saved:** shows once you saved an article. Me's "See all" leads here. Asked for with nothing saved, it goes to the default tab.

The Featured tab goes; featured articles keep their stamp and their nudge in For you.

**The feed is public.** It leaves `PROTECTED_PATHS`. A visitor gets the articles (one tab, so no tab bar), an intro and Sign in. The community chips and "Lately" are for signed-in people only. The page is indexed with canonical `/feed`, and the sitemap lists `/feed` instead of `/journal`.

**`/journal` redirects permanently** to `/feed?tab=articles`, or to `?tab=saved` from its old Saved tab, so old links and search results still work. Articles keep their addresses (`/journal/<slug>`) and the Feed tab stays lit on them. Their back button goes up to the feed, for visitors too ([ADR 0061](0061-back-button.md)). The footer's Journal link and the feed's Journal chip go. "The Journal" stays the name of the team's articles ("From the Journal", "In the Journal" on title pages).

## Consequences
- `src/core/journal-feed.ts`: `feedTabs`, `pickFeedTab` and `feedTabForJournal` (with tests) replace the Journal's tabs.
- `src/app/[locale]/feed/page.tsx` reads only what the open tab shows. `src/app/[locale]/journal/page.tsx` is a redirect.
- The feed now costs a function call for visitors too, as `/journal` did.
- `e2e/journal.spec.ts`, `e2e/nav.spec.ts` and `e2e/social.spec.ts` cover the tabs, the redirect, the public feed and the back button.
