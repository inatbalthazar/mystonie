# ADR 0079: Pro styles on show, and a card you can see moves

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0034](0034-pro-subscription.md) and [ADR 0055](0055-beta-and-feedback.md) (Pro card styles hidden while Pro is off)

## Context
The owner (2026-10-02) asked for two things in the card's celebration:
- **Pro styles to choose from**, so people see what Pro has. Share, Download and the rest stay free, but a Pro style needs Pro first.
  - Pro styles already existed (Film Strip). They showed only while Pro could be bought, so during the beta nobody saw them.
- **A swipe people can find.** "Swipe for another style" was a line of text under the card. The card didn't move with the finger and changed at once, so nothing showed it could be swiped. It should also look smooth.

## Decision
**Pro styles are on the swipe for everyone signed in**, Pro on sale or not:
- **In the order of the styles**, with "(Pro)" after the name.
- **Without Pro, locked:** Share and Download are off, and a note offers Pro.
  - While Pro is on sale, it reads "Share and download it with Pro" with **Unlock**.
  - Before then, it reads "…once Pro opens" with **See Pro**. `/pro` shows the plans, not on sale yet.
- **The server still refuses** a Pro style's card without Pro (403 `pro_required`).
- **The anonymous card maker** on the landing page still offers only free styles: it's a first taste, not a shop.

**The card shows it moves** (`src/cards/style-swipe.tsx`, used by the celebration and the card maker):
- **A stack:** a second card peeks out behind, tilted, so there is clearly more than one.
- **A nudge:** a moment after the card lands, it slides aside twice on its own, showing the card under it.
  - It shows until someone swipes once (`mystonie.styleSwiped` in the browser's storage), then never again.
- **Dots** under the card, one per style, the current one long; a Pro style's dot is a small lock.
  - The celebration only: the card maker lists its styles as buttons already.

**The swipe itself is smooth:**
- **While dragging:** the card follows the finger and leans with it.
- **Let go past 40px:** it slides off that side and fades, and the next style comes in from the other side with the app's spring ([ADR 0070](0070-motion-and-loading.md)).
- **Let go short of that:** it springs back.
- **Change style** slides the same way.
- **Reduced motion:** no drag, slides or nudge; the style changes at once.

**Rejected:**
- **The neighbouring styles drawn at the edges**, a carousel. It shows the most, but it means drawing three full cards at export size at once. A tilted blank card behind says "more" at no cost.
- **Arrows beside the card:** the screen at 360px has little room beside a story card, and Change style is already a button.
- **A nudge on every opening:** after the first swipe it's noise.

## Consequences
- **Everyone signed in sees what Pro adds** on every movie and series card. It's still one style. More Pro styles, and Pro styles for books, games and recaps, would make the offer read better.
- **No migration.**
- **Tests:** `e2e/share.spec.ts` swipes from Polaroid to Bold Stats with the mouse, then goes to Film Strip, locked with See Pro (Unlock with `PRO_ENABLED=true`), and checks Download and Share are off. `e2e/pro.spec.ts` and `e2e/editor.spec.ts` still pass through the new swipe.
