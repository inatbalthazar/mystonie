# ADR 0084: More Pro card styles, one for each kind of card

**Status:** Accepted · **Date:** 2026-10-02 · Extends [ADR 0034](0034-pro-subscription.md) (Pro templates) and [ADR 0079](0079-pro-styles-on-show-and-card-swipe.md) (Pro styles on show)

## Context
The owner (2026-10-02) asked for more Pro card styles: one each for movies and series, books, games, and recaps, and each should look clearly better than the free ones.

Until now Pro had one style, the Film Strip, for movies and series only. So a book, a game or a recap card had nothing to show of Pro. ADR 0079 already noted that more Pro styles would make the offer read better.

## Decision
**Four new Pro styles,** each built on a premium material that suits its medium, so a Pro card is easy to tell from a free one at a glance:

| Style (id) | Cards | What it is |
|---|---|---|
| **Premiere** (`premiere`) | Movies and series, Finish and Progress | Opening night: the moment in lights on a gold marquee sign, the poster under glass in a gold case ringed with bulbs, the title on a lit letter board with the kind, year and two numbers on its rail. The rating and review make the poster's critic quote. |
| **Gilded** (`gilded`) | Books and manga, Finish and reading Progress | A collector's clothbound edition: the cover's colour as deepened cloth with its weave, a gilt frame and corners, the title stamped in gold, the cover tipped into a gilt-ruled plate (a medallion when there's no cover), and an Ex libris bookplate with the owner's name, the review as a handwritten inscription and the numbers. A book still being read has its ribbon marker out. |
| **Arcade** (`arcade`) | Games, Finish | Game clear at the arcade: the title in a neon marquee, the key art on a CRT (scanlines, vignette, glass) with GAME CLEAR!, a high-score table (hours, rating, day) and the review in an RPG dialogue box, over a neon grid. With no key art, the screen shows a sunset over the grid. |
| **Lineup** (`lineup`) | Weekly and monthly recaps, stats cards, Year in Review | The period as a festival poster: the headliner's poster printed in duotone with a halftone screen, the period ("MY WEEK") in giant condensed caps, its dates on a sticker, the most watched title as the headliner, the others on the bill ("+236 more"), favourites and the year's standouts in the fine print, and the numbers on a ticket stub. |

**How each fits in:**
- **Order:** each style is last on its card's swipe, after the free ones, so Film Strip still follows Bold Stats.
- **Default:** a card never opens on a Pro style.
- **Gating:** unchanged from ADR 0034 and ADR 0079. Each style is a locked preview without Pro. `POST /api/cards` refuses it with 403 `pro_required`, and the anonymous card maker never offers it.

**Two new card faces, loaded only when used:**
- **Cormorant Garamond** (600, 700): Gilded's book serif.
- **Press Start 2P**: the Arcade's pixel letters.

Both come through `next/font` with `preload: false`, like Caveat. Their `@font-face` rules are on every page, but nothing downloads until such a card is drawn. On cards they're `--card-serif` and `--card-pixel`, with the Noto fallbacks for Thai, Korean and Japanese.

**Gold:** `src/cards/gold.ts` holds the foil sweep and the gold ink that Premiere and Gilded share. Like the Film Strip's amber, these are fixed colours: gold reads on any poster.

**Copy:** the four style names (English and Thai), plus `Card.exLibris`, `Card.gameClear` and `Card.lineupMore`.

**Rejected:**
- **A holographic foil trading card for every kind:** it's one look repeated four times, and the owner asked for one style per kind of card.
- **Gradient (foil) text** for the gold lettering: `background-clip: text` doesn't survive the PNG export reliably. The stamped look comes from flat gold with a light top edge and a pressed-in shadow.
- **Only system fonts:** without a book serif and pixel letters, Gilded and Arcade read as costumes. Two Google fonts that download only for those cards cost nothing elsewhere. There's no new package: `next/font` is part of Next.
- **A "PRO" badge on the cards:** the people who share them are paying for the look, not for a label.

## Consequences
- **What Pro adds:** every kind of card a person shares (movie, series, book, manga, game, recap, stats, year) now has a Pro style, on show to everyone signed in.
- **Checks:**
  - `/card-lab` draws the new styles on every hard case (266 cards).
  - `e2e/cards.spec.ts` counts them, and its overflow checks pass on all 40 new cards, as checked on a production build.
  - `src/core/cards/saved.test.ts` pins the lists, that each Pro style is last and never a default, and where each one fits.
- **Exported PNGs:** CSS blend modes and filters (the Lineup's duotone), inline SVG ornaments and many soft shadows (Premiere's bulbs) render through `modern-screenshot`, as checked on exported cards.
- **No migration:** a saved card's `template_id` only has to match the id pattern.
