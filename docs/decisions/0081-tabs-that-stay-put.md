# ADR 0081: Me's tabs and the Atlas tab move like one page

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0053](0053-feed-tab-stats-in-me.md) and [ADR 0076](0076-cards-tab.md) (each of Me's tabs drew its own cover) and [ADR 0061](0061-back-button.md) (which pages are tabs)

## Context
The owner (2026-10-02): Me doesn't feel like one page. Tapping a tab reloads the whole page, Cards also swaps the logo at the top left, and the collection's Atlas tab does the same.

Why it happened:
- **The whole page moved.** Album (`/me`), Stats (`/stats`) and Cards (`/me/cards`) were three separate pages, and each one drew the cover and the tabs itself. So a tab:
  - slid the whole page sideways, cover and tabs included;
  - showed a skeleton of the whole page while it loaded;
  - read the cover again from the database.
- **The logo.** The back button didn't count `/me/cards` as a tab, so it put "‹ Me" where the logo was.
- **The Atlas.** It is also its own page (`/collection/atlas`). Its link wasn't prefetched whole, so the title and the tabs went back to a skeleton too.

## Decision
**Me has a layout** (`src/app/[locale]/(me)/layout.tsx`, a route group, so the addresses don't change):
- The layout draws the cover and Me's tabs once. The open tab follows the address (`MeTabs`).
- The layout stays while you switch tabs. Only the tab's page changes, sliding in from its side under the cover (`MeTabPage`, a `<ViewTransition>` keyed by the tab).
- A new query (another period on Stats, more cards) stays on the same tab, with Stats' own period slide.
- **Not read again:** the cover streams in its own `<Suspense>`, and the layout doesn't read it again on a tab switch.
- **Skeletons:** each tab's skeleton is only the tab's part (`SkeletonPart`). The Album page sits in its own group (`(album)`), so its skeleton never stands in for Cards.
- **The pages:** they no longer read the profile or the follow counts for the cover. `ProfileAlbum` with `me` returns only the album; visitors' `/u/<username>` keeps drawing its own cover.

**`/me/cards` counts as a tab** for the back button: there's no button and the logo stays. It is also named "Cards" when you go back to it ([ADR 0061](0061-back-button.md)'s list).

**The Atlas and the shelves stay two pages**, but move like one:
- **Title and tabs stay put:** while a page's own tabs slide sideways (`data-nav="tab-next"`/`"tab-prev"`), the title and the row of tabs (`data-stay`) get their own `view-transition-name`. So they stay put and only the page under them slides.
- **Prefetched whole:** the Atlas link and the shelves' links on the Atlas have their whole page prefetched, like Me's tabs ([ADR 0075](0075-instant-tabs.md)). So the switch doesn't wait on a skeleton.

**Rejected:**
- **A layout for the collection too:**
  - Watch · Read · Play are buttons that change a state inside the collection's view.
  - The shelf it opens on depends on its data (a picked title, `?shelf=`, the one shelf with anything on it).
  - Lifting that state into a layout would rewrite the view. Pinning the title and tabs during the slide gives the same result.
- **Pinning the cover with `view-transition-name` on Me as well:** the cover would only look still. It would still be read again and drawn again, and its skeleton would still flash while a tab loads.
- **One page for Me with the tab in a query (`/me?tab=stats`):** the links people have to `/stats` and `/me/cards`, and the back button's names, would change. A layout keeps them.

## Consequences
- **Moved files:**
  - `src/app/[locale]/me` → `(me)/me`, with the album page in `(me)/me/(album)`;
  - `src/app/[locale]/stats` → `(me)/stats`.
  - The skeletons' late fade now applies to any `[data-skeleton]`, not only a page's `<main>`.
- **Tests:**
  - `src/core/back.test.ts`: no back button on `/me/cards`.
  - `e2e/profile.spec.ts`: the logo stays on Cards, and the cover is the same element after a tab.
- **The same fix later:** a visitor's profile and its Stats tab (`/u/<username>`, [ADR 0077](0077-public-stats.md)) still draw their own cover per tab. They can get the same layout if needed.
- **Fixed 2026-10-03, the collection and its Atlas:** the title and the shelves still left between them. A switch shows the next page's skeleton first, and the skeleton had grey blocks in their place. Then the page settled in from 10px below, title and all, so the title bobbed.
  - Both skeletons (`collection/(shelves)/loading.tsx`, `collection/atlas/(map)/loading.tsx`) now draw the real title and shelves, named to stay. The collection's skeleton opens the shelf in the address (`ShelfTabsFromUrl`).
  - On these pages, only what's under the title and shelves settles in or fades (`globals.css`, `:has(> [data-stay])`).
  - The shelves' row keeps its sideways scroll from page to page, so on a narrow phone it doesn't jump back as the page under it changes.
  - Frame by frame at 360 px, both ways, the title and the shelves no longer move. Only the open tab changes.
