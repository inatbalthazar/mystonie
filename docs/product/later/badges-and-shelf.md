# F06 · Badges, achievements & visual shelf

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M5 · **Priority:** Nice-to-have (engagement)

## Summary
- **Badges** unlock from behaviour, e.g. "Rookie Bookworm" (5 books read), "Fear Conqueror" (10 horror movies finished), "Province Hopper" (20 Thai provinces).
- **Visual shelf:** a virtual shelf that shows finished games as cartridges/discs, movies as DVD/Blu-ray cases and manga as spine rows. It's the showpiece of a public profile.

## Rules
- Badge definitions are data (`badges`: slug, names th/en, icon, rule json such as `{ "group": "read", "count": 5 }` or `{ "genre": "horror", "type": "movie", "count": 10 }`).
- Evaluate rules with a pure function in `packages/core` (`evaluateBadges(entries, badges)`). The server also runs it on entry sync to award badges (`user_badges`), so awards can't be faked.
- Badge unlock shows a celebratory toast (respect `prefers-reduced-motion`).
- Shelf renders from existing poster/cover images. No new asset pipeline for MVP.

## Acceptance criteria
- [ ] Adding the 5th book awards "Rookie Bookworm" exactly once.
- [ ] Deleting entries does not revoke badges (proposed; confirm).
- [ ] Shelf is visible on public profiles and hidden for private ones ([F07](../features/S1-profile-privacy.md)).

## Data
`badges`, `user_badges`.

## Open
The badge catalogue (names, thresholds, art) is in [open questions](../../open-questions.md).
