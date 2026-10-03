# ADR 0091: Cards draw posters from their own URL

**Status:** Accepted · **Date:** 2026-10-03 · Extends [ADR 0008](0008-client-side-card-rendering.md) (cards render in the browser)

## Context
Cards render in the browser and export through a canvas, so their posters load with CORS (`crossOrigin="anonymous"`). The lists load the same posters as plain images.

Capturing the store screenshots ([ADR 0090](0090-store-listing-from-the-real-app.md)) showed the bug. "Make a card" from the collection made a card with no poster and the default colours.

TMDB's CDN and AniList's send `Access-Control-Allow-Origin` only to requests that carry an `Origin`, and without `Vary: Origin`. So the browser had cached the list's copy of the poster, with no CORS header, and reused it for the card's CORS request, which then failed. TMDB's case was the list's w342 poster. AniList's was the stored large cover, which lists show too.

## Decision
A card never asks for the URL a list loads:
- TMDB posters are drawn at **w780**. They are sharper in a 1080 px card too.
- AniList covers are drawn at the **large** size with **`?card`** added.
- RAWG art stays at 1280 px, as before.

`cardImageUrl` (`src/core/catalog/images.ts`) makes these URLs. The poster palette (`usePosterPalette`) reads the same image, so a card downloads its poster once.

The stored card data keeps the catalog URL, so `isCardPosterUrl` checks the same thing as before.

**Rejected:**
- **`crossOrigin` on every poster in the app:** it would need dozens of images, and one forgotten list brings the bug back.
- **A cache-busting query on every card image:** w780 already gives TMDB its own URL, with better quality.

## Consequences
- A card's TMDB poster weighs more, about 150 KB instead of 35 KB. The card maker already used w780.
- Any new place that draws a poster on a card must go through `cardImageUrl`, like `Poster` and Lineup do.
