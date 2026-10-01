# ADR 0068: The profile photo on cards

**Status:** Accepted · **Date:** 2026-10-02

## Context
Cards print `@username` in their footer ([S1 share artwork](../product/features/S1-share-artwork.md)). Since [ADR 0064](0064-facebook-sign-in-and-photos.md), people have a profile photo. The owner (2026-10-02) asked whether cards could show it too, as a choice.

A face on a shared card says whose card it is at a glance, the way a story shows its author. But the poster is the card's colour and its hero (design direction).

## Decision
**Where:** a small circle (52 px, the logo's size) before `@username` in the footer that every template shares (`CardFooter`).
- No template changes its layout.
- Without a photo, or when it fails to load, nothing shows (no empty circle).

**Choice:**
- It shows by default when the person has a photo, like the username.
- "Hide on card" gets **Photo** (`CARD_HIDEABLE` `photo`).
- Hiding the username hides the photo too: a face with no name reads oddly.

**Where it comes from:**
- The card editor asks `GET /api/account` once per page load (`useMyPhoto`). Settings forgets that answer when the photo changes.
- Saving a card, the server stamps `avatarUrl` from the profile, like the username. The browser never sends it (`parseCardData` drops it).
- Reading a saved card, `avatarUrl` is kept only when it is a photo in our `avatars` bucket (`isAvatarUrl`): `<user id>/<photo id>.<jpg|png|webp>`. A card's link must not be able to show an arbitrary picture under our name. Every profile photo lives there (ADR 0064).

**Old cards:**
- Cards saved before have no photo.
- A saved card whose photo was later replaced loses the circle on its page. Its PNG keeps the photo it was made with.

Rejected:
- **A big photo on the card** (a corner portrait): it competes with the poster and every template would need a new layout.
- **Off by default:** the photo is already public on the profile, and the username, equally personal, is on by default.
- **Passing the photo down like the username:** about 25 components pass `username` to the card editor. One cached request does the same job without touching them.

## Consequences
- `CardData.avatarUrl`, `footerUser()` now returns `{ username, avatarUrl }`, `isAvatarUrl` in `src/core/avatar.ts` (tested).
- The Privacy Policy says a card shows the username and photo unless hidden.
- `e2e/profile.spec.ts`: the uploaded photo shows on a card, "Photo" hides it, and the saved card carries the profile's photo, not one the browser sent.
