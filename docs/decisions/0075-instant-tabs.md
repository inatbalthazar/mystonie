# ADR 0075: Tabs that open at once, and quieter skeletons

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0070](0070-motion-and-loading.md) (skeletons on every tap, with a sheen)

## Context
The owner (2026-10-02) found the skeletons ugly and too much. They want Mystonie to feel as much like an app, one single page, as it can.

What happened on each tap of a tab: the tab pages are dynamic and have a `loading.tsx`, so Next prefetched only up to the skeleton.
- Every tap slid in a shimmering skeleton.
- Then the page replaced it with an entrance of its own.
- That was two movements and a flash of grey on every switch, even back to a tab seen a moment before.

## Decision
**1. Tabs are prefetched whole and open from memory.**
- The nav island's tabs and the divider tabs (the feed's, Me's Album · Stats) prefetch their whole page (`prefetch` on the `Link`) as soon as they're on screen.
- A tap shows the page at once. On a production build it took about 30 ms, and no skeleton showed.
- Next keeps such a prefetch for 5 minutes (`staleTimes.static`).

**2. Stale-while-revalidate (`FreshPage`, `src/components/motion/fresh-page.tsx`).** Home, the collection, the Atlas, the feed, Me and Stats carry the time they were rendered. A page that shows refreshes itself in the background (`router.refresh()`) and updates in place, with no skeleton and no animation, when either:
- it was rendered more than 30 seconds earlier;
- something was saved since: any successful non-GET `fetch` to `/api/`, noted by the island (`useChangeWatch`). That covers a follow on /people, a Stamp, a setting.

A clock off by more than 30 seconds either way just refreshes. Offline, it doesn't try.

**3. Quieter skeletons, where they still show** (title pages, profiles, the board, a slow network):
- **Still:** faint blocks, no sheen.
- **Later:** they appear after 300 ms instead of 150, so a page that comes quickly never flashes one.
- **During a slide:** a skeleton keeps that delay too. Before, the slide brought it in at once.

**4. A slide's direction clears when its transition ends.** A page shown from the cache doesn't always report its `<ViewTransition>` enter. That left `<html data-nav>` set, and the next update slid sideways. `NavMotion` now clears the direction when the view transition it belongs to finishes.

**Rejected:**
- **Removing the skeletons:** with nothing to show, a slow tap looks frozen. They stay for pages people wait on and that can't be prefetched (every title).
- **`staleTimes.dynamic` for every page:** every page would come back from memory. But title pages and profiles have no `FreshPage`, so they would show old follow, log and Stamp states for minutes.
- **Cache Components and Partial Prefetching (Next 16):** the right long-term model, an app shell per route with React `<Activity>` keeping pages alive. But it changes how every page caches, which is a migration of its own. Worth revisiting before a native-feeling v2.
- **A client-side data layer (SWR or React Query):** a new package, with every page's data moved to the client. That is against the single-app, server-rendered setup (ADR 0006).

## Consequences
- **More server work:**
  - Each signed-in page prefetches up to four tab pages, plus the feed's other tab, every 5 minutes.
  - A background refresh makes them prefetch again, so it happens at most once per 30 seconds of use, plus after a save.
  - That's fine for the beta. Watch Vercel function and Supabase usage after launch, and raise `FRESH_MS` if it grows.
- **Production only:** prefetching happens only in production builds. `pnpm dev` behaves as before, so check smoothness on `pnpm build && PORT=3100 pnpm start` or the deployed site.
- **Tests:**
  - `e2e/motion.spec.ts` passes on the production build too (`E2E_BASE_URL=http://localhost:3100`).
  - The usual e2e run stays on `pnpm dev`.
