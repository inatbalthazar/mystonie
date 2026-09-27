# ADR 0024: Saved cards, share links and the celebration

**Status:** Accepted · **Date:** 2026-09-27

## Context
[S1 share artwork](../product/features/S1-share-artwork.md) asks for:
- a celebration after every finish;
- Finish / Progress cards and a Stats Sticker;
- saving cards (inputs in `cards`, the PNG in Storage on share);
- a public `/c/[id]` page with a link preview that works in X, Facebook and iMessage.

Other constraints shaped the design:
- supabase-js stays out of the browser ([ADR 0020](0020-auth-passwordless-ssr.md)).
- iOS rejects a share that awaits anything before `navigator.share()`.
- Link previews are fetched without a session.

## Decision
- **Template metadata lives in `src/core/cards/templates.ts`** (`id`, `kinds`, `sizes`, `tier`), and the components are mapped by id in `src/cards/registry.tsx`.
  - The server validates a saved card (template fits kind and size) without React.
  - Kinds: Ticket = finish; Polaroid and Bold Stats = finish + progress; Sticker = sticker.
  - Adding a template = a component, a registry line, a metadata line and its label.
- **`POST /api/cards` saves a card's inputs** as the user (RLS; composite FKs keep the entry or log the user's own). The same client UUID v7 again updates it, so Download then Share, or a style change, is one row.
  - `params` is a validated snapshot of the card (`parseCardData`: TMDB-only poster URLs, review ≤ 80 characters, hidden items).
  - The `@username` on a card comes **from the profile on the server**, never from the request, so a card link can't be made to show someone else's name.
  - Download saves the inputs too (the profile gallery can show them later); only Share publishes (`shared_at`).
- **PNG upload: a public `cards` bucket with no client write policies.** On share, the server (service role, after the RLS insert succeeded) creates a signed upload URL for `<user_id>/<id>.png`, and the browser PUTs the PNG to it with `fetch`.
  - Limits: 5 MB, PNG only.
  - Rejected: uploading through our route handler (Vercel's 4.5 MB body limit, a double hop).
  - Rejected: Storage RLS policies with supabase-js in the browser (ADR 0020).
  - Public, because a shared card is an explicit publish and previews fetch it without a session. Account deletion removes the files (the rows cascade).
- **Share stays synchronous:** the card id is known before saving, so the `/c/[id]` link goes into the share sheet at once while publishing runs alongside.
  - Without file sharing (desktops), the primary button is **Copy card link**: publish, then copy.
  - Rejected: waiting for the upload before opening the share sheet (iOS would reject it).
- **`/c/[id]` shows the stored PNG, or re-renders the card from `params`** if there is no upload yet or it fails to load. The page is `noindex`: shared on purpose, but not for search engines.
- **The link preview is `opengraph-image.tsx` with `next/og`** (1200×630): poster, stamp, title, facts and `mystonie · @username`.
  - It is English and Latin-safe, like the site's default image. A non-Latin title is left out of the image and carried by `og:title` (text the platform renders).
  - Rejected: the stored PNG as the OG image. It is 9:16 or 4:5, which X and Facebook crop badly, and it may not be uploaded yet.
- **The printed "short link" is the site host plus `@username`**, not `/c/<uuid>`: a 36-character id is unreadable on an image and images aren't clickable. The `/c/[id]` link travels with the share instead (share sheet URL / copied link, `?ref=card&tpl=`).
- **Progress cards are offered, not forced.** After a log on the series page, a small "Want a card?" appears; it becomes a highlighted milestone offer when the log crosses 25/50/75 % of aired episodes (`crossedMilestone`).
- **`signup_from_card`:** `/c/[id]` remembers the visit in `localStorage` (template id + time, 24 h). The signed-in landing page fires the event when the account is < 15 minutes old. This covers all three sign-in paths (code, email link in a new tab, Google).

## Consequences
- "Up next" logs don't offer a Progress card yet (it moves to Home with the Home task).
- The remote project needs `20260927120000_stage1_card_images.sql` (bucket) with the other stage 1 migrations.
- Soft-deleting a card (profile gallery task) should also remove its PNG.
