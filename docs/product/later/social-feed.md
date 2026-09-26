# F10 · Social community feed

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M5 · **Priority:** Nice-to-have

## Summary
Public accounts are worth more with a social layer: follow friends, see what they finished, browse their lists, and help verify content-warning timestamps together.

## Rules
- Follow is one-directional (`follows`: follower_id, followee_id). No approval needed for public accounts.
- Feed items are derived from `entries` (new finishes), `user_badges` (unlocked) and warning contributions. Only from users whose effective visibility is public ([F07](../features/S1-profile-privacy.md)).
- Feed includes a "Help verify" card that surfaces unverified warnings for titles the viewer has finished ([F05](crowdsourced-warnings.md)).
- Cursor pagination, newest first. No algorithmic ranking in v1.
- Basic safety: block user, report content.

## Acceptance criteria
- [ ] Following a public user shows their next finished title in my feed.
- [ ] A private user's activity never appears in any feed (RLS test).
- [ ] Blocking hides both users from each other's feeds and profiles.

## Data
`follows`, `blocks`, `reports`. The feed is a view/RPC over existing tables.
