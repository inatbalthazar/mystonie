# ADR 0070: Motion, skeletons and swipes

**Status:** Accepted, skeletons and tab loading changed by [ADR 0075](0075-instant-tabs.md) · **Date:** 2026-10-02

## Context
Mystonie moved with almost no animation: the FINISHED stamp and the card rising in the celebration, a stamp on a Stamp. Pages swapped at once after a blank wait, sheets popped in, buttons came in four shapes (`rounded-xl`, `rounded-2xl`, `rounded-full`, and a few `rounded-lg`), and a slow page showed nothing until all its data had arrived.

The owner (2026-10-02) asked for motion across the whole app, with Threads as the model:
- left and right swipes;
- animation that carries the eye while something loads;
- skeleton loading.

Button shapes and sizes could change where that's better. They confirmed doing all five rounds in one go.

## Decision
Threads lends the **feel**: quick, springy and small, with content that follows the finger. The look stays the scrapbook ([design direction](../design/design-direction.md)).

**No new package.** Everything is CSS, React's `<ViewTransition>` (built into Next 16's React, no configuration) and pointer or touch events. Motion (`motion`), though listed in the stack, was never installed and still isn't.

**1. Foundation** (`src/app/globals.css`, "Motion"):
- **Curves:** `--ease-spring` (a slight overshoot, for presses), `--ease-out-soft` (things arriving) and `--ease-sheet` (iOS's sheet curve).
- **Animations:** `animate-pop` (an icon bounces as it turns on), `animate-enter` (rise and fade in), `animate-fade`, `animate-hop` (Stonie waiting).
- **Press:** every `<button>` gives a little under the finger (`scale: 0.96`) and springs back; links that look like buttons add `press`.
- **Buttons are pills:** every main action (coral) and outline button is `rounded-full` with `press`. The heights stay:
  - `h-14` for the one big action of a sheet (Finished);
  - `h-12` for a screen's main action;
  - `h-11` for the rest.
  - A script changed 76 of them; cards and list rows that are buttons keep their shapes.
- **Reduced motion:** the last rule in globals.css turns every animation, transition and view transition into an instant change.
  - The e2e suite runs that way (`reducedMotion: "reduce"` in `playwright.config.ts`), so no test waits on an animation.
  - `e2e/motion.spec.ts` turns motion back on to test it.

**2. Skeletons and loading:**
- **`loading.tsx` on the app's main pages:**
  - Home, Feed, the collection's shelves and its Atlas, Me, Stats, a profile and a title page;
  - the board, challenges, a club, people, the reel and Settings.
- **How they look:** each follows its page's layout in muted paper with a slow sheen (`skeleton`, `src/components/skeleton.tsx`), so nothing jumps when the page arrives.
- **When they show:** shown the moment you tap (Next prefetches them), but faded in only after 150 ms, so a page that comes quickly never flashes one.
- **Arriving:** in the running app, every page settles in as it arrives (`body > main` fades and rises 10 px), including when it replaces its skeleton. The page of the first HTML, and its lists, show at once (`<html data-app>`; `NavMotion` ends their entrances before the next paint, without marking them, which would break hydration of what is still streaming): fading them in held back Largest Contentful Paint (Lighthouse mobile on `/` fell from 89 to 86).
- **The rest of the waits:**
  - Lists settle in item after item (`stagger`): the feed, the collection, quick add's results, people, the board, the album's previews (also when "Show all" opens).
  - The few placeholders that pulsed now shimmer like the skeletons.
  - Stonie hops (`StonieHop`) where a skeleton can't stand in: the Atlas's map unfolding, today's reel, the pre-watch check.
  - Big numbers (Stats, the collection's and the album's summary) count up when their page opens in the app (`CountUp`). In the first HTML and with reduced motion they're just the number, so a zero never flashes before hydration.
- **Where a 404 matters, no skeleton:**
  - A page with a skeleton streams, so it answers 200 even when it turns out missing (Next adds `noindex`).
  - So shared cards (`/c/[id]`), articles and an Atlas country keep their 404s and have no skeleton.
  - The collection's and the Atlas's pages moved into route groups (`(shelves)`, `(map)`) so their skeletons don't cover `/collection/atlas/[country]`.
  - A missing profile or title answers 200 with `noindex`, as Next recommends.

**3. Page transitions** (`template.tsx` files with `PageTransition`, `src/components/motion/`):
- **Where:** a new page slides in and the old one out. Templates under `/collection`, `/collection/atlas`, `/u`, `/title`, `/title/[kind]`, `/clubs`, `/settings`, `/journal` and `/c` do the same for their own pages.
- **Only the page moves:** the header and the nav island stay put (the island and the getting-started button are captured above the page, `view-transition-name`).
- **Which way** (`NavMotion` sets `<html data-nav>` from what was tapped):
  - a link goes **forward** (the old page goes 30% left as the new one comes in from 45% right);
  - the back button goes **back** (the other way);
  - the island's tabs **crossfade**;
  - a page's own tabs slide sideways in their order: the feed's, Me's Album · Stats, Stats' periods and the collection's shelves (`data-tabs` / `data-tab`).
- **The browser's own back and forward don't slide:** iOS animates its swipe-back itself, and two slides would fight. React renders a popstate at once, outside any view transition.
- **The app's back button:** it steps back through history (ADR 0061), so it starts its view transition itself around `router.back()` (`backWithTransition`).
- **One entrance at a time:** a page that slides in doesn't also play its own entrance (`body > main` settling in, a skeleton's late fade): `PageTransition` ends those as it enters, so the slide alone brings it in.
- **Within a page:** the feed's tabs (`?tab=`) and the collection's shelves (client state, in a transition) swap their content the same way, with a keyed `PageTransition`.
- **Browsers without view transitions** (older Safari, Firefox) change pages as before.

**4. Swipes** (`SwipeArea`, rules in `src/core/motion.ts`):
- **Where:** swipe left for the next tab, right for the one before:
  - the feed's tabs;
  - Me's Album → Stats and back;
  - the collection's Watch → Read → Play → Atlas.
- **How it feels** (Threads' carousel, as near as server-rendered tabs allow):
  - The content goes with the finger and fades as it goes (`swipeFollow`, `swipeFade`). Toward no tab it only gives, like a rubber band (40 px at most).
  - Let go on a swipe, it carries on out (at least a third of the way, `swipeLeave`) and waits there for the next tab, instead of springing back first.
  - The page transition then takes it off that side as the next tab slides in from the other (`tab-next` / `tab-prev`: 60% out, in from 70% of the page's width). A skeleton slides in like a page.
  - The first version slid 36–56 px and sprang back on release: on a phone the owner saw no slide at all (2026-10-02).
- **What counts as a swipe** (`swipeIntent`, `swipeResult`):
  - It is one when the finger goes clearly more across than down, 72 px or a quick flick.
  - Up and down stays a scroll.
- **Where it doesn't start:**
  - within 24 px of the screen's sides (the system's back gesture);
  - on rows that scroll sideways (Right now, the community pages);
  - on fields and sheets;
  - on anything that handles its own drags (`touch-action`).
- **Only a shortcut** for tabs that are on screen (mobile checklist).

**Sheets:**
- **Motion:** they rise from the bottom on phones and settle in the middle on wider screens, and go back the way they came (CSS `@starting-style` and `allow-discrete`, no JS). The backdrop fades with them.
- **Grabber:** they have one, and on a phone dragging the top down closes them (`sheetDismiss`: 110 px, or a flick); up gives like a rubber band.
- **What they show:**
  - A sheet keeps its content while it slides away, even when the caller has cleared it.
  - Each opening starts afresh, even one that comes while the last is still leaving.

**5. Details:**
- An icon pops when it turns on: Save on an article, Follow (the Stamp already stamps).
- A light vibration (`haptic()`, `src/lib/haptics.ts`) on a Stamp, a Save, a Follow and a swiped tab. This is Android only; the finish already had one.

**Rejected:**
- **Motion (the package)** for gestures and springs: CSS springs and view transitions cover what we do, and a 30–60 kB library would cost Lighthouse on every page. A later gesture that needs real physics would bring it back with its own ADR.
- **Real paging between tabs** (the next tab's content showing under the finger, Threads' carousel): it needs both tabs rendered at once, which our server-rendered tabs (and their data) aren't.
- **Delaying pages on purpose to show off an animation:** the wait is the server's. The skeleton covers it, and a page that is quick stays quick.
- **A skeleton on every page:** the pages above are the ones people wait on. The rest are static or quick, and 404 pages keep their status.
- **Hiding the island while scrolling** (as Threads does): still rejected (ADR 0050).

## Consequences
- **Code:**
  - `src/core/motion.ts` (+ tests): directions, swipe thresholds, sheet dismissal, counting up.
  - `src/components/motion/`: `NavMotion`, `PageTransition`, `SwipeArea`, `CountUp`, `StonieHop`.
  - `src/components/skeleton.tsx` and the `loading.tsx` and `template.tsx` files.
- **Tests:**
  - e2e runs with reduced motion. `e2e/motion.spec.ts` checks the directions, the skeleton in the first HTML, swiping between the feed's tabs and dragging a sheet closed.
  - In headless Chrome a sideways drag can be Chrome's own back or forward, so the test turns that off as on a phone (`overscroll-behavior-x`).
  - Text typed before a streamed page hydrates is lost, so tests that type right after landing retry, as the feedback test already did. The Atlas test now does too.
- **New pages:**
  - A page that people wait on gets a `loading.tsx` built from `skeleton.tsx` (not where its 404 matters).
  - A row of tabs gets `data-tabs` / `data-tab`.
  - A new primary button is a pill with `press`.
- **Lighthouse** mobile on `/`: 89, the same as before this change (89, LCP 3.7 s, measured on the same machine). It was under the 90 target already; the landing page's LCP is its own task.
- **Owner's real-device pass:** swipes and the sheet's drag on iPhone Safari and Android Chrome, in the browser and installed. Check them next to the system's back gesture.
