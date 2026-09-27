# ADR 0028: Home, an installable PWA and recap web push without an SDK

**Status:** Accepted · **Date:** 2026-09-27

## Context
The last stage 1 task asks for:
- a signed-in **Home** with "Next episode", recent cards and TMDB trending;
- a **PWA manifest** with an install prompt;
- **Weekly Recap web push** for installed apps ([ADR 0025](0025-weekly-recaps.md) moved it here).

Constraints:
- One Next.js app + Supabase, no new services ([ADR 0006](0006-single-nextjs-app.md)).
- iOS allows push only for apps added to the Home Screen (iOS 16.4+).
- Offline support is a later project ([offline sync](../architecture/offline-sync.md)).

## Decision
**Home is `/home`, the signed-in landing page.**
- Sign-in without a `next` lands there, the PWA starts there, and the header has a Home link.
- `/` stays the public card maker and landing page. It is static, so it can't tell who is signed in.
- Home shows, in this order:
  - the date, then a greeting;
  - the install prompt, then the notifications prompt;
  - the week's recap note;
  - "Up next";
  - recent cards: the newest 6, shared or only downloaded. Only shared cards link to `/c/[id]`;
  - trending: 9 titles from TMDB's weekly list, hidden if TMDB fails.
- "Up next" and the recap note moved from `/collection` to Home.
- A trending title links to `/collection?add=1&pick=<kind>:<id>`, which opens quick add on that title's status step. That is two taps to a finished title with its celebration.
  - The title is resolved on the server with `ensureTitle` (from the DB cache, else TMDB).
  - Rejected: a second quick-add flow on Home. It would duplicate the optimistic list and the celebration.

**Manifest:** `src/app/manifest.ts`.
- It has `start_url: /home?source=pwa`, standalone display, and the paper colour.
- The icons are made at build time from the Stonie mark by `src/app/pwa/[file]/route.tsx`: 192 and 512 px, a maskable 512 px icon with the mark inside the safe zone, and a one-colour badge.
- `appleWebApp` metadata makes an iOS Home Screen launch standalone.

**Install prompt:**
- Chromium: we keep its `beforeinstallprompt` event (caught on any page by `PwaListener` in the layout) and show our own Install button.
- iOS Safari: we show the Share → "Add to Home Screen" steps.
- Nothing is shown once installed, in other browsers, or for 30 days after "Not now".

**Service worker:** `public/sw.js` handles `push`, `notificationclick` and `pushsubscriptionchange` only.
- It has no fetch handler and no cache, so there is no offline behaviour to get wrong. Install no longer needs one in Chromium.
- It is served with `no-cache`, so fixes reach installed apps at once.
- It is registered only when the user turns notifications on.

**Push only in the installed app.**
- Settings → Notifications shows the switch only in standalone display mode. In a browser tab it explains how to install.
- In the installed app, Home also offers "Turn on" until notifications are on or dismissed.
- The permission prompt comes only after a tap on our own button.
- This follows the spec ("web push only for users who installed the PWA"). It also keeps one behaviour on every platform, since iOS can't push to a tab.

**Web push is implemented on Web Crypto in `src/core/push.ts`, without the `web-push` package.**
- It covers VAPID (RFC 8292, ES256 JWT) and aes128gcm payload encryption (RFC 8291 over RFC 8188), in about 150 lines.
- The unit test reproduces the RFC 8291 example byte for byte.
- It runs in Node, edge runtimes and Expo, like the unsubscribe HMAC.
- Rejected: `web-push`. It works, but it is Node-only and brings `http_ece`, `asn1.js`, `jws` and an HTTPS proxy agent, all for a single request type. Its CLI was also the usual way to make keys; `pnpm push:keys` (`scripts/vapid-keys.mjs`) does that instead.

**Subscriptions:** `push_subscriptions`, one row per device endpoint.
- Server-only, like `reports`. `POST /api/push` verifies the user and writes with the service role, so a device that changes account moves to the new one (a client upsert under RLS couldn't).
- The endpoint must be https on a known push service (FCM, Mozilla, Apple, WNS), so a forged subscription can't make the server call arbitrary URLs (SSRF). Outside production, `http://127.0.0.1` is also allowed for the e2e fake push service.
- Rows are hard-deleted: they are device tokens, not user content. They go on "off", on sign-out (the form sends this device's endpoint), when a push service answers 404/410, and with the account.
- Settings re-sends an existing subscription on load, so it follows whoever is signed in on the device.

**Sending:** the hourly recap job (ADR 0025) pushes before emailing.
- `weekly_recaps_to_push(limit)` returns recaps from the last 2 days with no `pushed_at`, with one row per device.
- Each recap is tried once and then marked, whatever the push services answer.
- A push failure never stops the emails.
- The notification is in the user's language ("Your week is in: Sep 21 – 27", the numbers). Tapping it opens `/recap/[id]`.
- Push is independent of the email opt-out: the device switch is its own opt-in.

## Consequences
- The owner creates VAPID keys once (`pnpm push:keys`) and adds `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (Sensitive) in Vercel. `VAPID_SUBJECT` is optional (default `mailto:` + the legal contact). Changing the keys invalidates every subscription.
- The remote project needs `20260927160000_stage1_home_push.sql`.
- Push needs a real-device check (Android Chrome and an installed iOS app): e2e covers the server side with a fake push service, but headless Chromium can't subscribe to a real one.
- `/` is still the card maker for signed-in users too. The "Landing (signed out) `/`, card maker at `/card`" split in [pages](../product/pages.md) is left for later.
