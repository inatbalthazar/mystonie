# ADR 0074: Dots for friends' finishes, new articles and today's reel

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0054](0054-feed-dot-reel-reminders.md) (one dot, about you only, rejected "dots on several tabs")

## Context
The owner (2026-10-02) hadn't played today's Reel of the Day, yet nothing on the nav island or the reel's own card said so. They also want a dot on Feed, and on its Following tab, when someone they follow does something, and one for new articles.

ADR 0054 lit Feed only for a Stamp on your finish or a new follower. Home's render was the only thing that told the device about it, so the dot also waited for a visit to Home.

## Decision
**What lights a dot:**

| News | Dot on | Cleared by |
|---|---|---|
| A finish by someone you follow, a Stamp on yours, a new follower | Feed in the island, the Following tab | opening Following |
| A Journal article newer than the newest you saw | Feed in the island, the Articles tab | opening Articles |
| Today's Reel of the Day not finished | Feed in the island, the Reel chip on the feed, Home's reel note | finishing it (on any device) |

- **One dot per place, coral, no count**, as before. The island's Feed tab doesn't show its dot on the feed's own pages, where the tabs and the chip show theirs. Screen readers still hear "Feed, new activity".
- **Where the news comes from:** `GET /api/feed/news` (signed in, rate-limited, no cache). It answers:
  - the newest Stamp or follow about you (`my_activity`);
  - the newest finish by someone you follow (the first such row of `following_feed`'s first 10);
  - the newest article (`newestArticleKey`, date and slug);
  - whether today's reel is finished.
- **When it asks:** the nav island asks on each signed-in page and when the app comes back to the front, at most once a minute per device.
- **What's seen stays on the device** (`mystonie.feedNews` in `localStorage`, logic in `src/core/feed-news.ts`):
  - opening Following saves the server's time;
  - opening Articles saves the newest article;
  - finishing the reel saves its day.
- **A first visit has no news:** a device or account seen for the first time takes the current activity and articles as seen. Today's reel still lights.
- **Home's reel note** knows the play from its own render, so its dot is drawn on the server.

**Rejected:**
- **Keeping it in Home's render only:** the dot then waited for a visit to Home, and Home doesn't read articles' dates or friends' finishes for this.
- **Read state on the server:** a write on every feed visit and a migration, for little gain (ADR 0054).
- **A dot on Home for the reel:** Home already shows the reel note with its own dot. The reel's page lives under Feed.
- **Lighting the dot for a reel started but unfinished only:** a reel not opened yet is the one most worth a nudge.

## Consequences
- **Always on:** the reel dot shows every day until the reel is finished. Someone who never plays will always see it. If that turns out to be noise, a setting to turn it off is the next step.
- **Cost:** one small request a minute at most while someone uses the app (four reads). Nothing is asked on signed-out pages.
- **Stored state:** ADR 0054's `localStorage` shape is dropped; old values are read as nothing, so the device starts over without old news.
- **Tests:**
  - `src/core/feed-news.test.ts` covers the rules;
  - `e2e/social.spec.ts` checks the Feed dot after a Stamp and a follow, the reel's dot on Home and the feed, the Following tab's dot after a friend's finish, and that Articles stays clear;
  - `e2e/nav.spec.ts` expects the new account's dot.
