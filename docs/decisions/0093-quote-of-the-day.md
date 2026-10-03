# ADR 0093: A movie quote of the day on Home

**Status:** Accepted · **Date:** 2026-10-03

## Context
Home's header showed the date in handwriting above "Hi, <name>". The owner asked for famous movie quotes in that spot, changing over time, and picked one of three ways:
- **A:** one quote a day, the same for everyone;
- **B:** a new one every time Home opens;
- **C:** quotes rotating every few seconds while Home is open.

## Decision
- **A, one quote a day.** It suits Home's daily rhythm (the Reel of the Day, streaks) and doesn't move while people read their feed, so it needs no reduced-motion fallback.
- The date stays, as a small line above. The quote takes the handwriting, with "Movie, year" under it.
- Tapping the quote opens the movie's page, which has Add.
- **Motion, once each time Home shows:**
  - The words ink in one after another: they fade up out of a blur, tilted like a hand's stroke.
  - Then the movie's line comes in, and a pen draws a wavy brand-colour line under it.
  - After the twelfth word, the rest come in together, so the whole thing takes about 1.5 s.
  - It's CSS only (`globals.css`, [ADR 0070](0070-motion-and-loading.md)). With reduced motion, the quote shows at once.
- **A list we curate** (`src/core/quotes.ts`): about 80 short, famous lines, each with its movie's TMDB id. No catalog offers quotes with clear terms, and a fixed list keeps them short and well chosen.
  - Lines stay in their original English. The attribution is translated.
  - Days run through the list in order, by the reader's local date, and start over at the end.

## Consequences
- Adding a quote means adding a line to the list. The tests check that lines are unique and short.
- Lines are brief and attributed, as quotes in reviews are. Don't add long passages.
