# F13 · Targeted native ads

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M6 · **Priority:** Revenue (low)

## Summary
No generic banner ads that clutter the app. Instead, **native ad cards** that match the user's interests, e.g. a user who reads a lot of one manga publisher sees that publisher's new volume, and horror fans see an upcoming horror release.

Sponsored Journal articles (for example a cinema paying for articles about its films) would be this kind of card, under these rules. The owner chose content only, no ads, for now (2026-10-01, [ADR 0052](../../decisions/0052-journal-feed.md)).

## Rules
- Ads are cards styled like content, clearly labelled "Sponsored".
- Targeting uses **aggregated interest segments** computed from the user's own entries (top genres, publishers, media types). The segment function is pure, in `packages/core`. Raw history is never sent to third parties.
- Campaigns are rows in `ad_campaigns` (creative, target segment rules, start/end, frequency cap, active).
- Frequency cap per user per day. Never show ads inside quiz, wheel or checkout flows.
- Users can hide an ad ("not interested"), and the PDPA consent setting controls personalised targeting (fall back to non-personalised).

## Acceptance criteria
- [ ] A user whose top Watch genre is horror sees an active horror campaign card in the feed/home.
- [ ] Frequency cap is respected.
- [ ] Turning off personalised ads switches to untargeted campaigns.

## Data
`ad_campaigns`, `ad_impressions`, `user_interest_segments` (materialized, refreshed on sync).
