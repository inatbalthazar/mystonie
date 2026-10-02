# ADR 0076: The cards leave the album for a Cards tab on Me

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0069](0069-arrange-the-album.md) (the card gallery first in the album) and [ADR 0027](0027-public-profiles-preferences-reports.md) (the public profile as a card gallery)

## Context
The owner (2026-10-02) doesn't want the card gallery to clutter the album. Two reasons:
- **It grows without end:** someone who makes many cards ends up with an album that is mostly cards.
- **Visitors don't come for it:** people opening someone else's profile don't want a page full of cards.

They asked for it to go, or for whatever handling works best.

## Decision
- **No card gallery on any album:** not on Me's Album tab, and not on `/u/<username>` for visitors. `"cards"` leaves `ALBUM_SECTIONS`. A saved order that still names it skips it (`albumOrder`), and Arrange no longer lists it.
- **Me gets a third tab, Cards** (`/me/cards`): Album · Stats · Cards, with swipes between them as before.
  - It holds every card you made, shared or only downloaded, newest first.
  - It shows 24 at a time, and "Show more" adds 24 more (`?steps=`, up to 480).
  - Only you see it. A downloaded card that was never shared says "Not shared" and has no link.
- **Each shared card keeps its own page** (`/c/<id>`), which is what a share sends people to.
- **Home's "Your recent cards"** now has "See all", which leads to the Cards tab. It used to say "See your page", but the page no longer has the cards.

**Rejected:**
- **A smaller gallery on the album (a strip of the latest few):** it would still be on visitors' pages, and the owner said they don't want them there.
- **Hidden by default, with a switch in Arrange:** it keeps the clutter one tap away and still needs a full list somewhere.
- **Pinned cards (choose a few to show on the profile):** maybe later, like the Shelf's favourites, if people ask to show off a card.

## Consequences
- **Visitors can no longer browse someone's cards.** A private profile's cards were never listable anyway (`shared_card()` opens one by id). No RLS or schema change, no migration.
- **Code:**
  - `PreviewList` (only the gallery used it) is gone.
  - The album's skeleton shows the shelf's posters instead of cards.
  - Me's and Stats' skeletons show three tabs.
- **Tests:**
  - `e2e/profile.spec.ts`: a visitor sees no card on the album, the owner's Cards tab links the shared card, and the arranging test moves "Right now" instead of the gallery.
  - `e2e/home.spec.ts` checks "See all".
