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
- Cards store their inputs (`cards` table: kind, template, params) so they can be re-rendered and shown on Me's Cards tab ([ADR 0076](../../decisions/0076-cards-tab.md)). The PNG is uploaded to Supabase Storage on share.
- Footer: `mystonie · @username` + short link `/c/[id]` → title page / sign-up ("Make your own card").
- Users can hide username or any stat on a card. The footer shows their profile photo before `@username` when they have one, unless they hide it ("Photo", [ADR 0068](../../decisions/0068-photo-on-cards.md)).
- Weekly Recap is computed by a scheduled job (pg_cron → route handler) per user time zone. Only users with activity that week get one.

## Built ([ADR 0024](../../decisions/0024-card-saving-and-share-links.md))
- **Celebration** (`src/components/celebration.tsx`, a full-screen `<dialog>`):
  - It opens right after **Finished**: quick add, changing an entry's status to finished, and "Yes, I finished it" on a series.
  - It shows the FINISHED stamp landing (`motion-safe:animate-stamp`) and a short vibration where supported. Both are skipped under `prefers-reduced-motion`.
  - The card preview comes with **Share** as the primary button (**Copy card link** where files can't be shared, e.g. desktops).
  - Secondary buttons: **Download**, **Change style** (or swipe), **Sticker** (a checkerboard shows the transparency).
  - The swipe ([ADR 0079](../../decisions/0079-pro-styles-on-show-and-card-swipe.md)): the card follows the finger and slides between styles; a card peeks out behind it, dots count the styles (a lock for Pro), and it nudges aside on its own until the first swipe.
  - Also: Story / Post size, and "Hide on card" (`@username`, Photo, watch time, episodes).
  - Rating and a one-line review are optional, below the actions. They are saved on the entry when the celebration closes (`PATCH /api/entries/[id] { rating, review }`).
  - **Skip** (then **Done**) is always in the sticky top bar.
  - "Make a card" in the edit sheet (finished entries) and "Make a Finish card" on the series page reopen it without the animation.
- **Progress card** (series page): every log offers "Logged S1 · E4. Want a card?". Crossing 25/50/75 % of aired episodes turns it into a highlighted milestone ("Halfway there! 🎉"). The card shows the milestone or episode, `EP 8/16` and the watched time.
- **Templates:**
  - Metadata is in `src/core/cards/templates.ts` (`kinds`, `sizes`, `tier`, and `titleKinds` for a template made for some titles only).
  - Ticket is for Finish cards; Polaroid and Bold Stats draw Finish and Progress cards; **Sticker** is white ink on a transparent background.
  - Books and manga add **Spine**, and manga also **Manga Panel**, which is where their cards open ([S2 books & manga](S2-books-manga.md), [ADR 0030](../../decisions/0030-book-manga-card-templates.md)).
  - Games add **Cartridge**, where their Finish cards open. Games have no Progress cards ([S3 games](S3-games.md), [ADR 0044](../../decisions/0044-games-rawg.md)).
  - Milestone cards open on **Stone** and Year in Review on **Yearbook**; monthly recaps use the weekly recap's templates ([S2 milestones & recaps](S2-milestones-recaps.md)).
  - A movie or series finish with a fun scare on DTDD (jump scares, zombies, …) is offered **Survived** ([S2 content warnings](S2-content-warnings.md)). It is still a `finish` card; only that template carries `survived`.
  - Every card's footer is `mystonie · @username` plus the site host.
- **Saving:** `POST /api/cards` stores the inputs (`params`, validated) with the username taken from the profile. Share also sets `shared_at` and returns a signed upload URL, and the PNG goes to the public `cards` bucket at `<user_id>/<id>.png`. Download saves the inputs only.
- **`/c/[id]`:**
  - A public, `noindex` page with the pasted-in card (the PNG, or a re-render from `params`), its line ("Finished Parasite") and the date.
  - CTAs: **Make your own card** (`/?ref=card&tpl=…`) and **Start your collection**.
  - The OG image (`opengraph-image.tsx`, `next/og`, 1200×630) has the poster, the stamp, the title (Latin only) and the facts. Twitter card: `summary_large_image`.
- **Events:**
  - `card_created {kind, tpl, card}`, `card_shared {tpl, size, channel: share_sheet|link, card}`, `card_downloaded {…, card}`.
  - `signup_from_card {tpl}`: a `/c/[id]` visit remembered for 24 h, then a new account (< 15 min old) landing on `/collection`.
- Tests:
  - `src/core/cards/saved.test.ts`;
  - `e2e/share.spec.ts` (finish → celebration → notes → publish → `/c/[id]` signed out → OG PNG; Sticker download);
  - `e2e/series.spec.ts` (Progress offer, milestone card, finish celebration);
  - `e2e/cards.spec.ts` (every template × kind × size in `/card-lab`, Sticker transparency).

### Weekly Recap ([ADR 0025](../../decisions/0025-weekly-recaps.md))
- **Schedule:**
  - pg_cron calls `POST /api/cron/weekly-recaps` hourly (bearer `CRON_SECRET`; the URL and secret live in Supabase Vault).
  - Users are due from their local Monday 09:00 when they logged an episode or finished a title in the week before. The week is Monday–Sunday in their time zone.
  - The route stores the week's numbers (`weekly_recaps.stats`, from `weeklyRecap` in `src/core/stats/recap.ts`), then emails up to 100 per run.
- **Email** (`Emails.recap`, `src/core/email/recap.ts`):
  - It shows the hours, episodes and titles finished, and a strip of up to 4 posters.
  - **Open my recap card** goes to `/recap/[id]` (signed in, owner only).
  - It has its own unsubscribe (`list=recaps`) and one-click `List-Unsubscribe`. Settings → Emails turns it back on.
- **Card:** `/recap/[id]` opens the celebration with the week's card.
  - Templates: **Collage** (default: an album page, posters taped in) and **Bold Stats**.
  - Sticker, Share, `/c/[id]` and the OG image all work as for Finish cards.
  - The collection page shows "Your week is in" for 7 days.
- **Web push** (built, [ADR 0028](../../decisions/0028-home-pwa-web-push.md)): in the installed app, Settings → Notifications (and a one-time note on Home) turns on recap notifications for that device. The hourly job pushes each new recap once, before the emails; tapping the notification opens `/recap/[id]`. Stage 4 adds opt-in Reel of the Day reminders under the same switch ([ADR 0054](../../decisions/0054-feed-dot-reel-reminders.md)).
- Tests:
  - `src/core/stats/recap.test.ts`;
  - `saved.test.ts` (recap parsing);
  - `email.test.ts` (recap email, per-list unsubscribe);
  - `stage1_weekly_recaps.test.sql` (due logic incl. time zones, RLS, cron job);
  - `e2e/recap.spec.ts` (finish → Monday 10:00 run → email → recap card → share → note → unsubscribe).

## Acceptance criteria
- [ ] Finishing a title shows the celebration with a rendered card in < 1 s on a mid-range phone. *The celebration opens optimistically, before the server answers, and the preview renders at once (e2e). Timing on a real mid-range phone is still to check (owner, with the real-device check).*
- [x] Stats Sticker PNG has a transparent background. (`e2e/cards.spec.ts`: exported corners have alpha 0.)
- [ ] Opening `/c/[id]` shows the card with a correct OG preview in X, Facebook and iMessage. *Page, `og:*` / `twitter:card` tags and the 1200×630 PNG checked locally (e2e). The previews in X, Facebook and iMessage need a deployed URL (after the stage 1 migrations go live).*
- [x] Weekly Recap arrives on the user's local Monday morning (configurable later). (Due from 09:00 local, hourly job: `stage1_weekly_recaps.test.sql` checks Bangkok vs New York, `e2e/recap.spec.ts` checks 08:00 = nothing, 10:00 = the email.)
- [x] PostHog events: `card_created`, `card_shared` (with `channel` if known), `card_downloaded`, `signup_from_card`. (`src/core/analytics.ts`; share / download events checked in `e2e/share.spec.ts`.)

## Data
`cards`, `weekly_recaps`, Storage bucket `cards`.
