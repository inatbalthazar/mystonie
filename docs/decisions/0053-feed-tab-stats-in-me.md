# ADR 0053: Feed takes Stats' place in the nav island, and Stats becomes a tab of Me

**Status:** Accepted · **Date:** 2026-10-01

> The Journal's chip on the feed went in [ADR 0062](0062-journal-in-the-feed.md): its list is now the feed's Articles tab.

## Context
The owner (2026-10-01) asked to give the nav island's Stats slot to the feed, and to fold the stats page into Me so it looks good there, because they think it's better UX. [ADR 0050](0050-mobile-first-nav-island.md) chose Home · Collection · ➕ · Stats · Me. It kept the feed off the island because Home's notes lead to it and to the community pages, and it called Stats a core tab ("Strava for shows"). Since then the feed also carries the Journal's newest articles ([ADR 0052](0052-journal-feed.md)), so a new account's feed is no longer empty.

## Decision
**The island is Home · Collection · ➕ · Feed · Me.** Feed (two people, `UsersRoundIcon`) opens `/feed`. It stays lit on the pages the feed's tabs lead to (the board, challenges, clubs, Reel of the Day, find people) and on the Journal, whose articles it carries (`navTab`, `src/core/nav.ts`). The feed's title becomes "Feed" (it was "Following") to match its tab; the handwritten kicker stays "What your people finished".

**Me has two tabs under its cover: Album (`/me`) and Stats (`/stats`).** They are the album's divider tabs as links, like the Journal's (`DividerTabs`, now shared). The same cover tops both: the photo, name, handle, "Collecting since", Settings, followers and following (`AlbumCover`, taken out of `ProfileAlbum`). So switching tabs leaves it where it was, and the Stats tab reads as part of your page. Me stays lit on Stats, Year in Review and Settings. The Stats tab is the stats page as before: period tabs, the big numbers with Share stats, heatmap, months, taste, favourites, records, milestones and the sticker album. Visitors at `/u/<name>` get no tabs, because stats stay private.

**`/stats` keeps its address.** Links in recap emails, the sticker toast's `/stats#stickers`, the offline page's saved pages and bookmarks keep working without redirects.

Small changes made with it:
- The feed's tabs to the community pages gain the Journal and become one row to swipe on a phone (wrapping from 640px), so the feed starts higher on the screen.
- Stats' period tabs each take their label's width, so "This month" fits on one line at 360px.

Why it's better:
- **How often.** The feed is a daily stop: friends' finishes, Stamps back, new articles. Stats are a weekly or monthly look, and they are about you. Strava does the same (Home is the feed, You holds Progress), and so does Letterboxd (an Activity tab, stats on the profile).
- **The community is one tap away.** The board, challenges, clubs and the reel were reached through Home's notes. Now they are on the Feed tab.
- **Stats lose one tap** (Me, then Stats). Me's Album tab still shows the all-time numbers, and the Stats tab sits right under the cover.

Rejected:
- **Stats inline on Me as one long page.** The album is long already; tabs keep both short.
- **`/me/stats` with a redirect from `/stats`.** People see no difference, but every old link (emails, the toast, offline pages, tests) would go through a redirect.
- **`/me?tab=stats`.** One page doing the reads of two.
- **Stats as Me's first tab** (Strava's You opens on Progress). Me is your album first, as visitors see it, and it already has the all-time numbers.
- **The feed as Home**, as in Strava. Home is the day's to-do list (up next, recaps, challenges, the reel); both stay.
- **A dot on Feed for something new.** It needs a request on every page load and a "last seen" per device. Later, if wanted. (Built in [ADR 0054](0054-feed-dot-reel-reminders.md), with no request of its own.)

## Consequences
- [ADR 0050](0050-mobile-first-nav-island.md)'s tab list is replaced; the rest of it (the island, ➕, `--island-space`, the keyboard) stands.
- The stats page reads the cover's profile fields and follow counts too (one more call to `follow_counts`).
- `e2e/nav.spec.ts` covers Feed (lit on the board too) and Me's tabs. `e2e/stats.spec.ts` reaches Stats through Me. Heading checks on the stats page use exact names, because the cover's heading is the account's name.
- The owner's real-device check now includes Feed and Me's tabs.
