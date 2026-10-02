# ADR 0061: An iOS-style back button at the top left of every page under a tab

**Status:** Accepted · **Date:** 2026-10-01

## Context
The owner asked for a "‹" back button on each page, as on iOS. Pages had their own back links, each worded differently ("← Atlas", "← Your collection", "← Following", "All articles", "Back to settings"), and many pages had none. Installed on a phone (standalone), the app has no browser back button, and iOS gives a home-screen app no swipe back either.

We chose between:
- **Up to a fixed parent** (a title goes to the collection): simple, but wrong when you came from somewhere else, such as a title opened from the feed.
- **The browser's back** (`history.back()`): right page, but it can't be named, and from a shared link it leaves the site.
- **Both, as iOS does:** back to the page you came from in the app, named after it, and up to a parent when there is none.

## Decision
**One button, in the header, in place of the logo**, on every page except the four tabs, their own tabs (the collection's Atlas, Me's Stats and Cards, [ADR 0081](0081-tabs-that-stay-put.md)) and the sign-in steps: a chevron and a name in coral, "‹ Atlas", 44 px tall, which dims when pressed.

**Where it goes:**
- **You came from a page in the app:** it steps back to it (`router.back()`), so the page's query, shelf and scroll come back. It is named after that page: a fixed short name for the main pages (Home, Collection, Atlas, Feed, Me, Settings, …), a country by its name, a profile by @username, and anything else by the title it had ("‹ Parasite"), or "‹ Back".
- **Opened from a link, a typed address or a fresh tab:** it goes up to the page's parent (`src/core/back.ts`: a country's regions to the Atlas, a title to the collection, the community pages to the feed, Settings to Me, …) and takes the page's place, as on iOS, so back from the parent doesn't come down again. A parent that needs an account is only offered signed in (by the `signed-in:` CSS variant). Pages with no parent (someone's profile, a shared card, the legal pages) keep the logo.
- **Swipe from the left edge**, only in the installed app: a round "‹" follows the finger and stepping back happens past 80 px.

**How it knows the page before:** the pages visited in the tab are kept in `sessionStorage` (`mystonie.back`, at most 30). A step back pops (the button, the browser's back or a swipe, by `popstate`), anything else pushes, and the same page with a new query changes nothing. A page's title is noted when you tap on it, when it is surely that page's. A page load that didn't come from the site (no same-origin referrer, not a reload) starts over, so the button never leaves the site. Without storage it goes up to the parent.

**The old links go:** the pages' own "← …" links are removed. Steps inside a flow (the import's steps, "Back to search" in quick add, the sign-in code) stay.

## Consequences
- `src/core/back.ts` (with tests): which pages have the button, their parents, their names, and the stack.
- `src/components/back-button.tsx` in the layout's header; the `Back` messages.
- `e2e/nav.spec.ts` covers back, up, the shelf coming back and the signed-out cases.
- New pages under a tab get the button for free; one with a natural parent adds a line to `PARENTS` in `src/core/back.ts`.
