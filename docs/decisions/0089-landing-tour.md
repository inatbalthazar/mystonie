# ADR 0089: The landing page tours the app

**Status:** Accepted · **Date:** 2026-10-03 · Extends [ADR 0071](0071-sign-up-and-more-providers.md) (sign-up on the landing page)

## Context
The owner (2026-10-03) asked for a landing page that matches what Mystonie does today, and that is more beautiful and exciting.

The page was still stage 0's. It had three parts:
- the headline;
- three example cards;
- the card maker.

It said nothing about books, manga or games. It also left out the collection, Stats, the Atlas, stickers, the Feed and the Reel of the Day, content warnings and the installed app.

## Decision
The page keeps its first screen and its card maker, and gains a tour between them. Everything stays in the scrapbook world of the [design direction](../design/design-direction.md):
- paper;
- tape;
- rubber stamps;
- stickers;
- coral.

No new colour, font or package is added.

**First screen:**
- The headline stays.
- The intro now names every kind of title.
- Label-maker tape lists the kinds: Movies, Series, Books, Manga and Games.
- The hero's button stays, with a line under it: free, no ads, works on any phone.
- The example fan is dealt as before, then a FINISHED stamp lands on it (`animate-stamp`). That's the moment a finish gets in the app.
- "Make your own ↓" jumps to the card maker.

**The tour** (`src/components/landing/feature-pages.tsx`). Each page has a big two-tone heading and one line. Next to them is a picture made of the app's own parts, with sample numbers:

| Page | Picture |
|---|---|
| Every episode, chapter and level (logging, import) | A taped list: a series halfway with its bar, a movie just stamped FINISHED, one saved for later |
| Your year in big numbers (Stats, recaps, Year in Review) | An ink ticket stub: three numbers that count up, the tear line, twelve months growing, the busiest one in coral |
| See the world from your couch (Atlas) | The real world map (`WorldMap`) with a sample collection in the Stories colours; its outlines load only when it's near the screen |
| Stickers for every milestone | Six real `Sticker`s stuck loose on the page, their names in pen (Caveat), Reel Legend's gold rim among them |
| Better with friends (Feed, Stamps, clubs, challenges, Reel of the Day) | Stonie's finish in the feed with Stamp, and a blurred Reel of the Day taped over its corner |
| Know before you press play (warnings) | The Heads up slip: yes or no with an icon and the votes, never colour alone |
| It lives on your home screen | A home screen with Stonie's icon, and **Install the app**, which opens the install sheet or the browser's own dialog (`askToInstall`, [ADR 0088](0088-install-from-the-checklist.md)) |

**How the pictures are made:**
- They're decoration (`aria-hidden`). The headings and lines carry the meaning.
- They borrow this week's trending titles, or the card lab's when trending is down.
- They come in with the motion of [ADR 0080](0080-numbers-and-bars-every-time.md): rise, deal, grow and pop.

On phones the pages stack. From 640px, the picture sits beside the words and the side alternates.

**The card maker:** it gets a heading of its own, "Make a card right now", with a line saying no account is needed. Under it, the sign-up box is the tour's last page. It is bigger, with Stonie alive.

The posters in the tour load the same way (`crossOrigin="anonymous"`) as the card maker's trending chips. Otherwise the browser's cached copy of a poster fails the chips' copy.

## Consequences
- The page is longer: about 6,000px at 360px wide. The first screen is unchanged in weight. The map's outlines (about 80 KB) load only when the map is near the screen.
- The tour's numbers are samples. It shows what the app looks like, not anyone's data.
- New features need a look at the tour, so the landing page doesn't fall behind again.
