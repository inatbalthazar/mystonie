# ADR 0095: The Shelf's top ten, and a Shelf card to share it

**Status:** Accepted · **Date:** 2026-10-05

## Context
The owner (2026-10-05) wanted to pick 10 favourites on the Shelf on Me (it took 4, [ADR 0069](0069-arrange-the-album.md)), and to share the Shelf.

## Decision
**Ten favourites.**
- `SHELF_PINS_MAX` is 10, and so is the database's check on `profiles.shelf_pins`.
- On the Shelf, each favourite carries its place (1 to 10) in a small brand-coloured circle over its top edge, in place of the star. With ten, the order is the point: it reads as a top ten.
- "Pick favourites" is unchanged: the poster grid numbers picks in order, and says when ten are picked.
- Rejected: keeping 4 as "one row on any phone". The Shelf wraps anyway, and two shelves show before "Show all".

**Share my shelf** sits next to "Pick favourites" under the Shelf on Me. It opens the celebration with a new card kind, `shelf`, like the Atlas card ([ADR 0059](0059-atlas.md)): drawn in the browser, then shared, downloaded or published at `/c/[id]`.
- **Data:** `CardData.shelf = { titles, pinned, total }`:
  - `titles`: the Shelf's first 10, favourites first, then the newest (name, kind and a catalog poster);
  - `pinned`: how many lead as favourites;
  - `total`: every finish on the Shelf.

  `src/core/shelf.ts` (`shelfCard`) builds it from the same `shelfItems` the page shows. `parseCardData` checks it: 1 to 10 titles, catalog posters only, `pinned` ≤ the titles, `total` ≥ the titles. A Shelf card is about no one title (`kind: "movie"`, no poster), like the Atlas.
- **The template** (`shelf`, "Bookcase", free, both sizes):
  - a wooden bookcase, five cases to a shelf, centred;
  - each favourite numbered on a tag;
  - the story size lists the names in handwriting under it;
  - then "N titles on my shelf" and the usual footer.

  The headline says "My top 10" when every title on it is a favourite, else "On my shelf".
- **Sticker:** a Shelf card can be a sticker, like the Atlas.
- Rejected: sharing a link to the profile's Shelf only. A card is how Mystonie shares everything else, and it works on a private profile too.
- Rejected: a separate "top ten" list apart from the Shelf. The pins already are one.

## Consequences
- Migration `20261026090000_stage4_shelf_ten.sql` raises the pin check to 10 and adds `shelf` to `cards_kind_check`. It must be on the remote project **before** this code deploys: until then, saving more than 4 favourites fails and a Shelf card can't be published (Download still works).
- Visitors see the numbered favourites on `/u/[username]`, as arranged.
