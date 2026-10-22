# ADR 0100: Rankings made simpler: one ＋ and drag and drop

**Status:** Accepted · **Date:** 2026-10-22

## Context
The owner (2026-10-22), after trying `/rank`: "Ranking should be simpler. The ＋ button has to be there, and ranking and tiering should be drag and drop, that's handier."

The first version ([ADR 0099](0099-rankings.md)) asked people to choose Top 3, 5 or 10 before adding anything, which left empty "Add #n" places to fill. Things moved with ↑ ↓ arrows on a top list. On a tier list you tapped a poster, then tapped a row in its tools. Both took several taps per move, and the arrows took up room on every row at 360px.

## Decision
**A top list grows with one ＋.**
- No Top 3 / 5 / 10 to choose. A single "＋ Add #n" sits at the end of the list, up to 10.
- The card still says "Top 3" or "Top 7" from how many things there are.

**Things are dragged into place**, on both kinds of list.
- **Top list:** drag a row by its grip (⋮⋮), which drags at once, even under a finger. Holding a finger anywhere else on the row also picks it up.
- **Tier list:** hold a poster and drag it to another row, or along its own row. A tap still opens its tools (Move to, ← →, ✕).
- A mouse drags as soon as it moves. A finger holds for 220 ms first, so a swipe still scrolls the page.
- While dragging:
  - a lifted copy follows the finger;
  - the list moves the thing as it goes, so you see where it will land;
  - the page scrolls near the top of the screen, or near the island at the bottom;
  - drops still find rows half hidden behind the sticky "Make the card" button or the island.
- **Accessibility:** the grip moves its row with the arrow keys. Move up and down buttons stay for screen readers, hidden until focused.

**The ➕ sheet links to it.** Under the search, a card, "Make a ranking: a top 10 or a tier list of anything, seen or not", opens `/rank`. Rankings take anything, finished or not, so they start from the same place as adding a title. The owner (2026-10-22) wants it to stand out more than the import, so the import below it is a small grey link.

**No package.** The drag is about 150 lines of pointer events in `src/components/rank/use-drag.tsx`, not dnd-kit or a similar library ([ADR 0006](0006-single-nextjs-app.md)).
- Placing a dragged poster in a row is `placeInTier` in `src/core/rankings.ts`, with tests.
- Two browser details it handles:
  - `touchmove` is blocked by a listener added before the touch starts. Chrome decides at the touch's start whether its moves can be cancelled.
  - The same listener goes on the element the touch started on. A poster moved to another row is drawn anew, and the touch's later events still go to the old, detached element.

## Alternatives considered
- **A drag-and-drop package (dnd-kit):** well tested, but a new dependency for two lists. Our needs are small: one list and a grid of rows, live reordering, and no nesting.
- **Native HTML drag and drop (`draggable`):** doesn't work with touch on mobile browsers, and people use Mystonie on their phones.
- **Keep the arrows next to the drag:** clutter at 360px. Kept only for keyboard and screen readers.

## Consequences
- Saved drafts from before keep their lists. Their old `size` is ignored.
- `e2e/rank.spec.ts` drags with the mouse: the grip on a top list, posters between tier rows. A touch drag (hold, then move) was checked with Chrome's touch emulation at 360px, light and dark. A real phone is the owner's check after deploying.
