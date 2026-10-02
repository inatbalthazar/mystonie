# ADR 0080: Numbers, bars and cards come in every time they're shown

**Status:** Accepted · **Date:** 2026-10-02 · Extends [ADR 0070](0070-motion-and-loading.md) (big numbers counted up once, on a page opened in the app)

## Context
The owner (2026-10-02): every stat number and every chart bar or progress bar should animate each time it's shown.

Before this:
- Only the big numbers counted up (Stats' headline, the collection's and the album's summary). They counted once, and only when their page was opened from a link in the app.
- A number further down the page had finished counting before anyone scrolled to it.
- Bars and progress just appeared.

## Decision
**Numbers** (`CountUp`, `src/components/motion/count-up.tsx`) count up from zero:
- when they come into view;
- each time they scroll back into view, after going out of sight;
- when their value changes, such as another period on Stats.

They count on Stats and on a visitor's Stats tab ([ADR 0077](0077-public-stats.md)): the headline, the minutes and counts in Taste, top genres and languages, Favourites, the Records' runtimes and streak, and the milestones. They also count in the collection's and album's summary, and in the Atlas regions' count and share.
- Names and dates never count, even with digits in them. A film called *2049* stays *2049*.

**Bars, charts and progress** (`Reveal`, `src/components/motion/reveal.tsx`, with classes in `globals.css`) grow from nothing to their size each time they come into view:
- `.grow-w`: from no width, for progress fills and ranked bars.
- `.grow-h`: from no height, for the months' bars.
- `.grow-pop`: the activity calendar's cells pop in week by week.
- `.grow-ring`: the getting-started ring draws itself.
- The bars of one chart follow one another (`--grow-delay`).
- **Covered:**
  - Stats: months, the taste bar, top genres and languages, activity.
  - Year in Review's months.
  - The progress of a series, a reading, a challenge, a challenge on Home, a sticker and the getting-started list.
  - The Atlas: a country's story bars, its regions, and the regions page.
  - The Reel of the Day's guess distribution.
- **How replay works:** `Reveal` sets `data-shown` while it's in view. The animation applies only with it, so it starts again each time `data-shown` comes back.
- **`backwards` fill:** after growing, the bar's own width transition still works. A progress bar still slides when you log an episode.
- **Not covered:** the import's live progress bar, which moves by itself.

**Cards** come in each time they're shown too (the owner, the same day), with the same `Reveal`:
- **Artwork cards** (`.deal`) are dealt onto the page. Each starts lower, smaller and tilted, then springs into its own slant, one after another in a row:
  - Me's Cards tab;
  - Home's "Your recent cards" (also as you swipe the strip sideways);
  - a shared card's page (`/c/<id>`);
  - the landing page's fan of examples.
- **Not covered:** the celebration sheet's card and the card studio, which already come in (`animate-rise`) and slide between styles ([ADR 0079](0079-pro-styles-on-show-and-card-swipe.md)).
- **Paper cards** (`PaperCard`, `.rise`): every scrapbook sheet in the app fades and rises into place. This covers Stats' sections, Year in Review and the challenge and series panels.
- **How it moves:** `translate`, `rotate` and `scale` are separate CSS properties, so a card's own tilt class is where the animation ends. The animation runs only while the card is coming in and leaves no transform behind.

**On the server's first HTML:**
- Bars grow on the first paint, straight from CSS: `data-shown` is in the HTML.
- A number already on screen stays as it is, rather than flashing from the number to zero once the page hydrates.
- A number below the screen counts when it's scrolled to.

**Reduced motion:** nothing counts or grows; everything is there at once.

**Rejected:**
- **CSS scroll-driven animations** (`animation-timeline: view()`): no JavaScript, but tied to the scroll position. A bar grows only as fast as you scroll, a bar already on screen never grows, and Firefox doesn't have them.
- **A chart package:** the charts are plain elements ([ADR 0026](0026-stats-page.md)), and a `width` from 0 keyframe does the job. No new package ([ADR 0006](0006-single-nextjs-app.md)).
- **`scale` instead of width or height:** cheaper to draw, but it squashes the rounded ends while it grows.

## Consequences
- **Every page with stats moves a little more.** Each animation is under a second and plays only where you're looking.
- **No migration, no new package.** e2e runs with reduced motion, so the tests see the final numbers at once.
