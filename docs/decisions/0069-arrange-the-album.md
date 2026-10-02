# ADR 0069: The album as its owner arranges it

**Status:** Accepted · **Date:** 2026-10-02

## Context
The album (`/u/[username]`, and Me's Album tab) grew section by section: the numbers, Right now, the Atlas, Saved to read, Stickers, Challenge patches, Clubs, The shelf, and last the Card gallery. On a 360 px phone the cards, the reason people visit, sat several screens down, under the map and the shelf.

The owner (2026-10-02) asked which section should come first, and better, to let people arrange the sections themselves by drag and drop, as easy as possible on a phone. They also wanted to pin favourites, on the Shelf.

## Decision
**Every section is short:**
- Following the mobile checklist, long sections show two rows and "Show all (N)":
  - the Card gallery: 4 cards on phones, 6 from 640 px;
  - The shelf: two shelves, however many fit;
  - Stickers (already).
- Right now is one row that scrolls sideways on phones.
- Short sections make the order a preference, not a page that only works one way.

**The default order:** under the cover and the all-time numbers, which never move:
1. Card gallery
2. Right now
3. The shelf
4. Stickers
5. Atlas
6. Challenge patches
7. Clubs
8. Saved to read (only the owner sees it)

The cards come first because they are what Mystonie is for, and what a visitor arriving from a shared card came to see.

**Arrange (Me only):**
- The "Arrange" button opens a bottom sheet listing the sections by name. Each row has:
  - a drag handle;
  - up and down arrows;
  - an eye that hides or shows the section.
- **Moving:**
  - Only the handle drags (`touch-action: none`), so the sheet still scrolls with a finger anywhere else.
  - A row swaps with its neighbour once the finger passes half a row. Pointer events, no package.
  - The arrows serve people who can't drag, and the arrow keys work on the handle; a live region says the new position.
- **Hiding:**
  - The Atlas's eye is the existing "Show my Atlas on my profile" switch (`atlas_public`), so there aren't two settings for one thing.
  - The sheet says what hiding means: a section leaves the album, but nothing becomes private. That is what the private profile is for.
- **Saving:**
  - Save sends `albumOrder` and `albumHidden` to `PATCH /api/account`.
  - "Default order" resets the order. Closing without saving drops the changes.
  - Visitors see the album as arranged, and Me shows what they see.

**Favourites on the Shelf:**
- "Pick favourites" under the Shelf (Me only) opens every finish as a poster grid, with search past 12. Tap to pin up to **4** (one row on any phone), numbered in shelf order.
- Pinned titles stand first on the Shelf with a small star. The hint says "Favourites first, then newest".
- A pin whose title is no longer a live finish drops out.

**Data:**
- New `profiles` columns:
  - `album_order text[]`: empty means the default;
  - `album_hidden text[]`;
  - `shelf_pins uuid[]`: title ids.
- **Checks:**
  - Only the known sections are allowed, the same list as `ALBUM_SECTIONS` in `src/core/album.ts`.
  - The Atlas is never in `album_hidden`.
  - At most 4 pins, none null.
- **Access:**
  - The owner updates them through column grants.
  - `public_profile()` returns them while the profile is visible.
- **Unknown or missing sections:** `albumOrder()` drops unknown names and appends sections the saved order doesn't name, in the default order. A section added later lands at the end of an arranged album and never goes missing.

**Rejected:**
- **Dragging the sections on the page itself:** the sections are tall, a long-press drag fights page scrolling, and a dragged map or grid covers the whole screen.
- **A drag-and-drop package (dnd-kit):** a list of 8 short rows needs about 40 lines of pointer handling.
- **Favourites as a new section above everything** (a Letterboxd-style "four favourites"): the owner preferred them on the Shelf, where finished titles already stand.
- **Pinning from the collection's title sheet:** pinning is about the Shelf, so it lives on the Shelf.

## Consequences
- **Code:**
  - `src/core/album.ts` holds the sections, order, hiding, parsing and moving.
  - `src/core/shelf.ts` adds `shelfItems(…, pins)`, `parseShelfPins` and `SHELF_PINS_MAX`. Both are tested.
- **Migration `20261021090000_stage4_album_layout.sql`** (pgTAP: `stage4_album_layout.test.sql`) must go on the remote project before the next deploy.
- **Components:** `ArrangeAlbum`, `ShelfFavourites`, `PreviewList` and `ShelfRows`.
- **Data export:** includes the arrangement.
- **e2e:** `e2e/profile.spec.ts` pins a favourite, moves and hides sections with the arrows, drags a row, cancels, and checks that a visitor sees the album as arranged.
- **Adding a section** means adding it to `ALBUM_SECTIONS`, to the migration's check lists in a new migration, and to `useSectionName`.
