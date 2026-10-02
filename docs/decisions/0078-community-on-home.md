# ADR 0078: The community pages move to Home, all in sight

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0053](0053-feed-tab-stats-in-me.md) (the community pages under Feed) and [ADR 0074](0074-more-feed-dots.md) (today's reel lights Feed)

## Context
The feed opened with a row of community links: The board, Challenges, Clubs, Reel of the Day and Find people. It scrolled sideways. On a phone only the first three showed, with Clubs cut off at the edge, so nothing said there was more to swipe to.

The owner (2026-10-02) asked to move the row to Home, and how people would know it scrolls.

## Decision
**On Home, under the greeting:**
- The five community pages as shortcuts side by side, in a grid of five: The board, Challenges, Clubs, Reel and Find people.
- Each is an icon on a small card, slightly crooked like the rest of the album, with its name under it.
- **All five are in sight at 360 px**, so there is nothing to swipe and nothing to discover. That answers the owner's question by removing the scroll instead of hinting at it.
- The names are short ("Reel", not "Reel of the Day") so each fits on one line at 360 px.
- The Reel's icon is a puzzle piece, not a clapperboard: with the short name, a clapperboard read as a video (like other apps' reels), and the reel is a guessing game.

**The Feed** keeps its tabs (Following, Articles, Saved) and the visitors' Sign in. Its row is gone.

**The island:**
- **Lit tab:** the community pages (`/board`, `/challenges`, `/clubs`, `/reel`, `/people`) now keep Home lit (`NAV_TAB_PATHS`), not Feed.
- **Back button:** opened from a link, these pages go up to Home (`backParent`).
- **Today's reel moves its dot to Home:**
  - Home's tab gets the dot ("Home, today's reel waits") while the reel waits and you're on another tab.
  - Home's reel note keeps its own dot.
  - Feed's dot is now for its own news only: friends' finishes, Stamps and followers, and new articles.
- **The Reel shortcut has no dot:** the reel's note on the same page has it, and two dots for one thing would be noise.

**Rejected:**
- **Keeping the sideways row, with a fade or an arrow at its edge:** a hint is still a guess, and five links fit without one.
- **Two rows of chips that wrap:** taller, and it reads as a tag list, not as places to go.
- **Keeping the reel's dot on Feed:** the reel's page no longer lives under Feed, so the dot would lead nowhere on it.

## Consequences
- **Two "Find people" links on Home** for someone who follows nobody yet: the shortcut and the friends section's link. Both go to the same page.
- **No migration.**
- **Tests:**
  - unit tests: `nav.test.ts` and `back.test.ts`;
  - `e2e/nav.spec.ts`: the five shortcuts are all in the viewport, The board keeps Home lit, back says "‹ Home", and Home has the reel's dot on Feed;
  - `e2e/social.spec.ts`: the reel's dot moved to Home;
  - `e2e/motion.spec.ts`: the forward and back slides now use Find people from the feed's empty state.
