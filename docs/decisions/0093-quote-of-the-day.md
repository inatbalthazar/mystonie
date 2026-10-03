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
- **Motion, on a loop** (the owner wants people to spend a moment with it):
  - The words ink in one after another: they fade up out of a blur, tilted like a hand's stroke.
  - Then the movie's line comes in, and a pen draws a wavy brand-colour line under it.
  - After the twelfth word, the rest come in together, so writing takes about 1.5 s.
  - The quote stays about 7 s. Then the pen line pulls away and the words fade in the same order.
  - **Then a random other quote is written** (the owner's call, after a first version that rewrote the same one). So the day's quote opens Home, the same for everyone, and the rest play on for as long as Home is open. The date above stays as it was, with no label.
- **One size, one header height; the greeting makes room.** A quote's length would otherwise move everything under it with each swap.
  - Every quote is written at the same size.
  - The quote and "Hi, <name>" share a header of fixed height. A one-line quote leaves the greeting at its foot.
  - When a quote wraps, the greeting fades away and the quote takes its place. It comes back with the next one-line quote.
  - The page measures the real line count with the real font and width, again on resize. `quoteFitsOneLine` is the server's first guess.
  - Measured on a 360 px phone: 60 quotes take one line and 20 take two. On 320 px, one takes three and the header grows for it, never clipping.
  - The tests cap a quote at 75 characters (`QUOTE_MAX_CHARS`). The two longest lines (Forrest Gump, Ferris Bueller) became shorter lines from the same movies.
  - **Versions that didn't work:**
    - Sizing quotes by length bands in a box three lines tall left short quotes floating in empty space.
    - Fitting each quote's size to the box made sizes jump between quotes, and clipped some quotes on some devices.
  - The keyframes are CSS (`globals.css`, [ADR 0070](0070-motion-and-loading.md)). A small client component (`src/components/quote-of-the-day.tsx`) swaps the quote when a cycle ends. With reduced motion, the day's quote shows still and doesn't change.
- **A list we curate** (`src/core/quotes.ts`): about 80 short, famous lines, each with its movie's TMDB id. No catalog offers quotes with clear terms, and a fixed list keeps them short and well chosen.
  - Lines stay in their original English. The attribution is translated.
  - Days run through the list in order, by the reader's local date, and start over at the end.

## Consequences
- Adding a quote means adding a line to the list. The tests check that lines are unique and short.
- Lines are brief and attributed, as quotes in reviews are. Don't add long passages.
