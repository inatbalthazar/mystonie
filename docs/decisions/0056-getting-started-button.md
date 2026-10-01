# ADR 0056: The getting-started checklist floats on every page behind a round progress button

**Status:** Accepted · **Date:** 2026-10-01 · Changes where [ADR 0046](0046-getting-started-checklist.md)'s checklist lives

## Context
The getting-started checklist ([S4 getting started](../product/features/S4-getting-started.md), ADR 0046) sat in Home's flow, so it was only seen on Home. The owner (2026-10-01) wants it on every page: a floating circle-progress button that opens the checklist as it looks now.

## Decision
- **The button:**
  - A round button, 56 px, floating over the bottom right of every signed-in page, just above the nav island (`bottom: var(--island-space)`).
  - A coral ring fills as steps are done, with "2/5" inside. At 100 % a bouncing party popper shows instead.
  - It is labelled "Getting started: 2 of 5 done" for screen readers.
  - It steps aside for the phone keyboard like the island. It is hidden on `/import`, whose Import bar sits in the same place, and when printing.
- **The sheet:**
  - Tapping the button opens the same checklist in the app's `Sheet` (a modal `<dialog>`: up from the bottom on phones, centred on wider screens).
  - It has the progress, the bar, the five steps and "Skip for now". At 100 % it shows the celebration and "Nice".
  - A step's link closes the sheet on its way to the page.
  - It never opens by itself.
- **The counts:**
  - The layout is shared by static pages, so the button asks `GET /api/getting-started` (head-only counts of `entries`, `cards`, `user_avoid_topics`, `follows` and `club_members`) on each page and each time it opens.
  - It asks only while it's still in use: signed in (the pre-paint `data-auth` hint), not skipped, not celebrated. After that, no request is made.
  - "Installed", "skipped" and "celebrated" stay in `localStorage` as in ADR 0046.
- **Home** no longer has the checklist card, and no longer reads the avoid-topics, follow counts and clubs it only needed for it.
- **Events:** `getting_started` gains `action: "opened"`.

Rejected:
- **Keeping the card on Home as well.** The same checklist would show twice on Home.
- **Opening the sheet by itself for new accounts.** A modal that pops up uninvited is the tour overlay ADR 0046 ruled out. The button and its ring do the nudging.
- **Seeding the counts from Home only (like the Feed dot, ADR 0054).** A step done on another page (a first title added on the collection, topics picked in Settings) wouldn't tick until Home was opened again.
- **A pill with the words "Getting started".** It is wider over the page on a 360 px phone. The ring and count are enough, and the sheet says the rest.

## Consequences
- One small authenticated request per page for new accounts, until they finish or skip. Rate limit: 120 a minute.
- The button covers a corner of the page above the island. Pages with a bottom bar of their own must be added to `HIDDEN_ON` in `src/components/getting-started.tsx`.
- Settings' "Show the getting-started checklist" brings the button back.
- `e2e/home.spec.ts` covers the button on another page, the sheet, a step's link, skipping and Settings.
