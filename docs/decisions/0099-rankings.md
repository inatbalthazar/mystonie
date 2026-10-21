# ADR 0099: Rankings: a Top 3, 5 or 10 of anything, as a card

**Status:** Accepted · **Date:** 2026-10-22 (all four steps)

## Context
The owner (2026-10-21) wants people to make rankings and tier lists as cards ("Top 3, 5, 10" and tiers), not only of what they finished, so they share them and make content of their own. Rankings and tier lists are a staple of film, anime and travel posts, and each one starts an argument that brings people to make their own.

The owner's decisions (2026-10-21/22):
- **Not only what you finished**, but a ✓ shows what you did finish, and it can be hidden. Don't force users.
- **Every kind:** movies, series, books, manga, games, and countries and their provinces or states.
- **A Pro card that clearly looks Pro.**
- **Build it in steps:**
  1. Top lists (this ADR);
  2. tier lists;
  3. rankings in the feed, with filters;
  4. "Make your own" from someone's list (remix).

## Decision
**A ranking is a card**, kind `ranking`, like the Shelf card ([ADR 0095](0095-shelf-top-ten.md)).
- **Data:** `CardData.ranking = { items }`, 1 to 10 items in order.
- **Each item:** a `ref` naming what it is, its kind, name, year, catalog poster and an optional note (60 characters).
  - Titles: `tmdb:movie:603`, `google_books:book:…`, `anilist:manga:…`, `rawg:game:…`.
  - Places: `country:JP` or `region:TH-10`.
- **Name:** the list's title (60 characters, "My top 5" when left empty).
- **Checks:** `parseRanking` in `src/core/rankings.ts` checks every ref against its catalog or place list and allows catalog posters only.
- **No table:** the items live in `cards.params`; the migration only adds the kind.

**The ✓ comes from the server.**
- When the card is saved, `rankingDone` (`src/data/rankings.ts`) replaces whatever the browser sent:
  - titles the owner finished;
  - countries they've been to or lived in;
  - regions they marked on the Atlas.
- The maker shows the marks beforehand from `POST /api/rankings/done`.
- The celebration's "Hide on card" offers **✓ marks** and **Notes** (new `CARD_HIDEABLE` values) next to the name and photo.

**Making one: `/rank`** (signed in), from a card at the top of Me → Cards.
- Name it (optional) and pick Top 3, 5 or 10 (up to 10 in all; "Add one more").
- Fill each place from a sheet with two tabs:
  - **Titles:** search across every catalog.
  - **Places:** search countries in your language or English; take the whole country, or open it and pick one of its regions from the Atlas's maps.
- Reorder with up and down arrows: tap targets that work at 360px, not drag and drop.
- Add a line to any item.
- The list is kept on the device until the card is made.
- Then the usual celebration: Share, Download and styles. There's no sticker, since a ranking has no numbers.

**Two styles.**
- **Countdown (free):** a ruled notebook page taped onto the card's colour.
  - Number one is big, its poster beside a huge numeral.
  - The rest are on the lines, in two columns on the feed size when there are many.
  - A round ✓ stamp sits on number one; small ✓ marks on the rest.
- **Hall of Fame (Pro):** black velvet in a gilt frame, the name in gold serif.
  - Number one is in a foil frame under laurels.
  - The rest are numbered in Roman numerals on gold rules.
  - **A gold "PRO" seal** is pinned in the corner, so the card says it was made with Pro.
- **Places** are drawn as their own outline (the world map's country, or the region's shape from its country's map, zoomed to its biggest piece of land) in the card's accent or gold.
- **Colours:** the card takes them from the first poster on the list (`paletteSource`).

**Rejected:**
- **A separate rankings table:** the list is only ever a card, like the Shelf; a table waits for the feed and remix steps, if they need one.
- **Only titles you've finished:** the owner wants any list. The ✓ keeps the album honest instead.
- **Trusting the browser's ✓:** a mark that says "I finished this" must be true.
- **Drag and drop:** fiddly on a phone and for screen readers.
- **Letting a ranking be a sticker:** the sticker template draws numbers.

## Consequences
- **Migration** `20261028090000_stage4_rankings.sql` adds `ranking` to `cards_kind_check`. Apply it to the remote project before this code deploys; until then, publishing a ranking fails (Download works).
- **Tests:**
  - `src/core/rankings.test.ts` and `src/core/cards/saved.test.ts` cover the data;
  - the card lab has two ranking fixtures (ten mixed items, three places);
  - `e2e/rank.spec.ts` makes a list with a title, a place and a ✓ and publishes it.
- **Steps 2, 3 and 4** follow below.

## Step 2: tier lists (2026-10-22)
**A tier list is its own card kind, `tier_list`, on the same data.**
- `CardData.ranking` gains `tiers` (1–6 labels, 12 characters each) and each item a `tier` (its row's index). Up to 30 items.
- `parseRanking` accepts `tier` only when there are `tiers`, and every item must then name a row. A `ranking` card has no tiers and a `tier_list` card must have them, so each kind keeps its own templates.
- The same server-set ✓ marks (`markDone` keeps the rows). No notes: there's no room on the card.
- **Rejected:**
  - **A flag on the `ranking` kind:** the template list comes from the kind, and a Countdown can't draw rows.
  - **Drag and drop between rows:** as for top lists. Tap a poster, then tap its new row; ← → within a row.
  - **Removing a row with things in it:** they'd vanish or land somewhere unasked. Only empty rows can go.
- **Styles:**
  - **Tier board (free):** a paper board on the card's colour, the classic row colours (red to purple) as sticky notes.
  - **Gold tiers (Pro):** the Hall of Fame's velvet, gilt frame and PRO seal (now shared in `src/cards/pro-velvet.tsx`), gold plaques, posters in foil frames.
  - Posters take the biggest size at which every row fits (`tierPosterHeight`), wrapping long rows.
- The migration adds `tier_list` with `ranking`; it went on the remote project through the MCP on 2026-10-22.

## Step 3: in the feed (2026-10-22)
- **`following_rankings(p_before, p_limit)`** (security definer, signed in only) lists the shared `ranking` and `tier_list` cards with their PNG, of the people the caller follows and their own, under `following_feed`'s rules (public profiles, no blocks either way, live follows). `src/data/rankings.ts` turns them into posts (`FeedRanking`).
- **Placed by date** among the finishes (`mergeByTime`), only among the pages loaded so far, as the Journal's articles are (ADR 0052): the feed's paging stays the finishes' own.
- **The filter:** All · Finishes · Rankings as chips under the tabs, in the address (`?show=`).
  - **Articles aren't a filter:** they have their own tab, and Finishes already takes them out of Following.
  - **Not remembered:** like the Journal's filters; a saved choice would need the preferences cookie or the profile, which can wait for people asking.
- **Rejected:**
  - **One feed RPC with both kinds of rows:** the finish rows carry Stamps, ratings and stickers that a ranking has none of, and paging would have to cross two tables.
  - **Stamps on rankings:** Stamps belong to finishes (`stamps.entry_id`); "Rank these your way" is a ranking's reply. Revisit with the feed's numbers.
  - **A dot on Feed for new rankings:** the dots count finishes and articles (ADR 0074); rankings show up with them.
- **Migration** `20261029090000_stage4_rankings_feed.sql` (the function and an index of shared rankings). On the remote project through the MCP on 2026-10-22. Without it the feed would still load, without rankings (the failing read is logged).

## Step 4: remix (2026-10-22)
- A shared ranking's page offers **Rank these your way**, to `/rank?from=<id>`. The page reads the shared card (`loadCard`, the same read as `/c/<id>`) and passes its list through `remixRanking`: the same name, things, order and rows, without its maker's ✓ marks and notes.
- **No link back to the original** and no counts of remixes: that would need a column or a table; wait for the feed's numbers to show whether people want it. The feed's posts carry the same "Rank these your way".
- **Rejected:** copying in the browser from the card's image page (the server already has the list, checked).
