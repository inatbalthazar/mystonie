# S1 · Share artwork

**Stage:** 1 (builds on the [S0](S0-card-maker.md) templates) · Premium templates in [S2 Pro](S2-pro-subscription.md)

## Summary
The heart of Mystonie, modelled on Strava's post-activity share. Every finish or episode log produces a card the user is proud to post.

## Card types in stage 1

| Card | Trigger | Content |
|---|---|---|
| **Finish Card** | status → finished | poster, FINISHED stamp + date, runtime or episodes, rating, one-line review |
| **Progress Card** | episode log (offered, not forced), and 25/50/75% milestones of a series | "EP 8/16 · halfway there", watched time |
| **Stats Sticker** | user chooses "Sticker" | transparent PNG with just the stats, to place on the user's own photo in IG |
| **Weekly Recap** | every week (user's local week), notification by **email** (primary); web push only for users who installed the PWA (iOS requires install) | titles finished, episodes, hours, poster collage |

## Celebration flow
1. After "Finished": a full-screen celebration with a stamp animation (plus haptic where supported; respect `prefers-reduced-motion`).
2. The card preview is shown with the primary button **Share**. Secondary: **Download**, **Change style** (swipe templates), **Sticker**.
3. Rating and one-line review are optional inline fields. Skip is always visible.

## Rules
- Templates live in `src/cards/templates/*`. Each is a React component + metadata (`id`, `kinds`, `sizes`, `tier: free|pro`). Adding a template requires no other code changes.
- Rendering is client-side (component → PNG, [ADR 0008](../../decisions/0008-client-side-card-rendering.md)). Link previews (`/c/[id]` OG image) use `@vercel/og` with Latin-safe content, or the stored PNG.
- Cards store their inputs (`cards` table: kind, template, params) so they can be re-rendered and shown in the profile gallery. The PNG is uploaded to Supabase Storage on share.
- Footer: `mystonie · @username` + short link `/c/[id]` → title page / sign-up ("Make your own card").
- Users can hide username or any stat on a card.
- Weekly Recap is computed by a scheduled job (pg_cron → route handler) per user time zone. Only users with activity that week get one.

## Acceptance criteria
- [ ] Finishing a title shows the celebration with a rendered card in < 1 s on a mid-range phone.
- [ ] Stats Sticker PNG has a transparent background.
- [ ] Opening `/c/[id]` shows the card with a correct OG preview in X, Facebook and iMessage.
- [ ] Weekly Recap arrives on the user's local Monday morning (configurable later).
- [ ] PostHog events: `card_created`, `card_shared` (with `channel` if known), `card_downloaded`, `signup_from_card`.

## Data
`cards`, `weekly_recaps`, Storage bucket `cards`.
