# S4 · Rankings

**Stage:** 4 (the owner, 2026-10-21) · **Built** 2026-10-22 (all four steps) ([ADR 0099](../../decisions/0099-rankings.md)); made simpler the same day: one ＋ and drag and drop ([ADR 0100](../../decisions/0100-drag-to-rank.md))

## Summary
Make a Top 3, 5 or 10 of anything: films, series, books, manga, games, countries, or provinces and states. Seen it or not, it's your list. It becomes a card to share. What you've finished, or been to, gets a ✓ you can hide. The Pro style looks unmistakably Pro.

## Steps
1. **Top lists and their card** (built).
2. **Tier lists** (S, A, B, C, D, rows you can rename), on the same machinery (built).
3. **Rankings in the feed** of the people who follow you, with a filter (built).
4. **Remix:** "Rank these your way" from someone's list (built).

## Behaviour (step 1)
- **Where:** `/rank`, from "Make a ranking" at the top of Me → Cards, or the "Make a ranking" card in the ➕ sheet (under the search, above the smaller import link). Signed in only.
- **Making it:**
  - Name the list, optional: "My top 5" when empty, 60 characters at most.
  - One **＋ Add #n** at the end of the list adds the next thing, up to 10 ("That's 10, the most a top list holds"). The card says "Top n" from how many there are.
  - It opens a sheet with two tabs:
    - **Titles:** search across movies, series, books, manga and games. Already-listed results are greyed out.
    - **Places:** search countries in your language or English, and tap one for the whole country. "Places in it" opens its regions (from the Atlas's maps), searchable.
  - **Drag** an item into place by its grip ⋮⋮ (at once, even under a finger), or hold a finger on the row and drag it. The list makes room as it goes, and the page scrolls near the screen's top and bottom. On the grip, the arrow keys move it; screen readers get Move up and Move down buttons. ✕ takes it off.
  - "+ Add a line about it" opens a note of up to 60 characters.
  - A ✓ shows next to what you finished or have been to (the server's answer).
  - The list stays on this device until the card is made. "Start over" clears it.
- "Start over" sits under the list, away from "Make the card", which sticks above the nav island (leaving room for the getting-started button while it shows).
- **The card:** "Make the card" opens the celebration.
  - Share, Download, the size and Change style. No sticker.
  - "Hide on card": the username, the photo, **✓ marks** (when there are any) and **Notes** (when there are any).
  - **Countdown** (free): a notebook page. Number one is big, and the rest are on ruled lines (two columns on the feed size with more than six).
  - **Hall of Fame** (Pro, locked without Pro like every Pro style): velvet, gold, laurels, Roman numerals and a gold PRO seal.
  - Places are drawn as their own outline.
- **Shared:** `/c/<id>` says "Top 3: <name>". Me → Cards lists it by its name.
- **Events:**
  - `ranking_made { count, type: "top" | "tier" }`;
  - shares as `card_shared` with `card: "ranking"` or `"tier_list"`.

## Behaviour (step 2, tier lists)
- **Where:** the same `/rank`, switched with **Top list | Tier list** at the top. Each keeps its own list in the draft; an empty one starts from the other's things (a tier list puts them all in the first row; a top list takes the first ten, top row first).
- **Rows:** S, A, B, C, D to start, each in its classic colour (red, orange, yellow, green, blue, then purple).
  - Tap a label to rename it, up to 12 characters ("Must watch"); a blank label stays its letter.
  - "Add a row" up to 6; the bin on an empty row takes it off.
- **Things:** ＋ at the end of a row opens the same Titles / Places sheet, "Add to S". Up to 30 in all ("12 of 30").
  - **Hold a poster and drag it** to another row or along its row (a mouse drags at once). A drop on a row but not on a poster puts it at the row's end.
  - Tap a poster for its tools: **Move to** S A B C D, ← → within its row, ✕ off the list, Done.
  - No notes on a tier list: the card prints no names but places' and poster-less titles'.
- **The card:** headline "Tier list", the name, then a row per tier that has something in it (empty rows are left off).
  - Posters are as big as the rows allow (`tierPosterHeight`), wrapping when a row is long.
  - Places are their outline with their name; a title without a poster shows its name.
  - **Tier board** (free): a paper board on the card's colour, a sticky note per row, a ✓ badge on what you finished or have been to.
  - **Gold tiers** (Pro): the Hall of Fame's velvet, gilt frame and PRO seal; gold plaques for the rows, thin foil frames for the posters.
  - "Hide on card": the username, the photo and the ✓ marks.
- **Shared:** `/c/<id>` says "Tier list: <name>".

## Behaviour (step 3, in the feed)
- **Following** (Feed's first tab) has the ranking and tier list cards that the people you follow **shared**, and your own, among the finishes by date. Sharing is the publish: a card only downloaded never shows. Private and blocked profiles never show, like their finishes.
- **A post:** who and when ("Top 5 · 2 hours ago" or "Tier list · …"), the card's image (to its page), the list's name and its first three things (numbered on a top list; a tier list's from its top row down), "and 7 more", then **Rank these your way** (not on your own).
- **The filter** under the tabs: **All** (finishes, rankings and the Journal's newest articles), **Finishes** (no rankings, no articles), **Rankings** (only rankings, up to 30). It lives in the address (`?show=`), like the Journal's filters; Following opens on All.
- With All, the newest 10 rankings go in among the finishes loaded so far; older ones wait for "Load more" to reach their date.
- Rankings with nothing on Rankings: "No rankings from the people you follow yet" and **Make a ranking**.

## Behaviour (step 4, remix)
- A shared ranking or tier list's page (`/c/<id>`) asks "Would you rank them differently?" with **Rank these your way** in place of the card maker's link.
- It opens `/rank?from=<id>` (signed out: sign-in first, then back). The maker starts from that list: the same name, things, order and rows, in the right mode. Its maker's ✓ marks and notes stay behind; yours come from the server. The other mode's draft is kept.
- The address drops `?from=` once the list is in the draft, so a reload keeps your changes.
- **Event:** `ranking_remixed { type }`.

## Acceptance criteria (step 1)
- [x] A list of 1–10 titles of any kind and places, in order, with optional notes, makes a card in two sizes and two styles (one Pro). (`src/core/rankings.test.ts`, `src/core/cards/saved.test.ts`, card lab)
- [x] The ✓ is set by the server from the collection and the Atlas, and can be hidden; notes can be hidden. (`src/data/rankings.ts`, `e2e/rank.spec.ts`)
- [x] Places are searchable by country and region, and drawn as outlines. (card lab: `rank-three`)
- [x] Checked at 360px, light and dark, in a browser (2026-10-22); a real phone is the owner's check after deploying.

## Acceptance criteria (steps 2 and 4)
- [x] A tier list of 1–30 things on 1–6 named rows makes a card in two sizes and two styles (one Pro); empty rows are left off; long rows wrap and fit. (`src/core/rankings.test.ts`, `src/core/cards/saved.test.ts`, card lab: `tier-full`, `tier-small`)
- [x] Things move between rows and along a row, by tapping or dragging; only empty rows can be removed. (`moveToTier`, `shiftInTier`, `placeInTier`, `removeTier` tests, `e2e/rank.spec.ts`)
- [x] A top list grows with one ＋ and is ordered by dragging; a finger's drag doesn't scroll the page, and a swipe that isn't held still does (ADR 0100; touch checked in Chrome's emulation at 360px, light and dark, 2026-10-22).
- [x] A shared ranking starts your own with the same things and rows but none of its maker's marks or notes. (`remixRanking` test)
- [x] A follower sees a shared ranking in Following with "Rank these your way"; Finishes hides it and Rankings shows it; its maker sees it without the link. Private, blocked, unfollowed, unshared and deleted ones never show. (`stage4_rankings_feed.test.sql`, `mergeByTime` and `parseFeedShow` tests, `e2e/rank.spec.ts`)
- [x] `e2e/rank.spec.ts` passes (2026-10-22).

## Data
`cards.kind` takes `ranking` and `tier_list`; the list is `cards.params.ranking` (a tier list's also has `tiers`, and each item its `tier`). See [data model](../../architecture/data-model.md).
