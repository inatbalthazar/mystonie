# ADR 0030: Spine and Manga Panel card templates, chosen by title kind

**Status:** Accepted · **Date:** 2026-09-28

## Context
[S2 books & manga](../product/features/S2-books-manga.md) asks for two card templates for reading: a **Spine** (a book spine on a shelf) and a **Manga panel**. [ADR 0029](0029-books-manga-reading-progress.md) shipped books and manga with the existing Polaroid, Bold Stats and Ticket templates and left these two to their own task.

Until now a template declared only the card kinds it draws (`finish`, `progress`, …). A spine makes no sense for a movie, and a manga page makes little sense for a novel. The card maker on `/` and the celebration list every template that fits the card kind.

## Decision
- **Template metadata gains an optional `titleKinds`** (`src/core/cards/templates.ts`). A template without it draws every title, as before.
  - `spine`: Finish and Progress cards for **books and manga** (manga volumes stand on shelves too).
  - `mangaPanel`: Finish and Progress cards for **manga** only.
- `templatesFor(cardKind, titleKind)` and `templateFits(id, cardKind, size, titleKind)` take the title kind. `parseCardSave` checks the template against the card's own `data.kind`, so a saved movie card can't claim the spine.
- **A new card opens on the template made for its title** (`defaultTemplate`): the Manga Panel for manga and the Spine for books, both for Finish and Progress cards. Movies and series keep the Polaroid (finish) and Bold Stats (progress). The other templates are still one swipe away.
- The card maker on `/` searches movies and series only, so its template list is `templatesFor("finish", "movie")`, which is unchanged.
- Rejected: separate template lists per title kind in the UI. That puts the rule in React and lets the server accept templates the UI would never offer.
- Rejected: making the Spine and Manga Panel the only choices for reading. Polaroid and Bold Stats already draw reading cards well, and the choice costs nothing.

**The templates** (`src/cards/templates/spine.tsx`, `manga-panel.tsx`):
- **Spine:** a shelf of spines on a striped wall.
  - The title is printed down a paper-stock spine (`writing-mode: vertical-rl`, so Japanese stands upright and Latin and Thai run sideways the way English spines do). It is cut with an ellipsis when long, and Stonie is the publisher's mark at the foot.
  - The cover faces out, leaning.
  - A Finish card gets the "Finished" stamp. A Progress card gets a bookmark ribbon on the spine and a taped note with where the reader is ("Chapter 1,100", "Halfway there").
  - The full title, stars, review and numbers sit under the shelf.
- **Manga Panel:** black ink on the paper stock.
  - The cover fills the big panel, and a speech bubble breaks out over its border with the headline ("Finished", "Chapter 1,100").
  - The title sits on screentone dots in the cover's accent colour.
  - The numbers sit inside focus lines.
  - The last panel has the date, stars and review, or speed lines when there's no review.

## Consequences
- `/card-lab` has four new hard cases: a book with a cover, a Japanese manga with a long title, a running manga at chapter 1,100, and a Thai book halfway through without a cover. `e2e/cards.spec.ts` checks that every template fits, and exports the Spine (Thai, sideways) and the Manga Panel (Japanese) through the real PNG path.
- A later template for one title kind only needs `titleKinds` in its metadata.
- The Polaroid title now has the side padding its review already had: a Japanese long title overhung its box by a few pixels.
