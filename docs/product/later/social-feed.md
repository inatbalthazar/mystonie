# F10 · Social community feed

> **Status: BUILT in stage 3** as [S3 social](../features/S3-social.md) ([ADR 0037](../../decisions/0037-social-follows-stamps-blocks.md)): follows, the Following feed, Stamps (the kudos), blocks and find people. That spec is the source of truth. Still open from this design: badge and "Help verify" items in the feed (they come with their own stage 3 tasks).

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
