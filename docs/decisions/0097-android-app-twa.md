# ADR 0097: The Android app on Google Play is a Trusted Web Activity of mystonie.com

**Status:** Accepted · **Date:** 2026-10-06 · Follows [ADR 0090](0090-store-listing-from-the-real-app.md) (the store listing) and [ADR 0028](0028-home-pwa-web-push.md) (the PWA)

## Context
The owner (2026-10-06) asked for Mystonie as an app people can download from Google Play. The roadmap kept "Native app (Expo)" gated for its store fees and a new runtime; this request is the owner's go for the Play Store.

Mystonie is already an installable PWA:
- a manifest with maskable icons;
- a service worker that works offline (ADR 0042);
- web push (ADR 0028);
- mobile-first everywhere (ADR 0050).

The listing's text and pictures are ready in `brand/play-store/` (ADR 0090).

## Decision
**A Trusted Web Activity (TWA), built with Bubblewrap.** The Android app is a small shell that opens `https://mystonie.com/home?source=twa` in Chrome, full screen with no address bar. It's the same site, so:
- every deploy updates the app, with no store review for app changes;
- sign-in, push, offline and cards work as they do in the installed PWA;
- there's one codebase, one Next.js app (ADR 0006).

- **Package:** `com.mystonie.app` (`ANDROID_PACKAGE` in `src/core/android.ts`). Play never lets it change.
- **The Android project** lives in `android/`: `twa-manifest.json` is its source, and Bubblewrap generates the Gradle project from it. The signing key (`android.keystore`) and its passwords stay with the owner, never in the repo (`.gitignore`).
- **Digital Asset Links:** `/.well-known/assetlinks.json` vouches for the app with the certificate fingerprints in `ANDROID_CERT_SHA256` (not secret, set in Vercel). It needs two fingerprints: the upload key's and Play App Signing's. Until they're set, the answer is `[]` and the app shows Chrome's address bar.
- **The site knows it's the app.** The first page carries `?source=twa` or Chrome's `android-app://com.mystonie.app` referrer, and the session remembers it (`isAndroidApp`).
  - It counts as installed (`isStandalone`), so the app never asks to install itself.
  - The Install step of getting-started is done, and push can be switched on.
- **No payments in the app.** Play wants payments for digital goods inside an app to go through Google Play Billing. The Buy Me a Coffee tip brings the Supporter sticker, so it's hidden in the app: the footer link and the Settings card (`NotInAndroidApp`). Pro isn't on sale. When it goes on sale, the Android app must sell it through Play Billing (TWA's Digital Goods API) or not sell it there.

**Rejected:**
- **Expo / React Native:** a second app to build and keep in step, and a new runtime. Kept for later (widgets, Stories share) if a TWA isn't enough.
- **Capacitor (a WebView with the site inside):** a WebView lacks Chrome's sign-in cookies, push and the PWA's service worker as Chrome runs them. Play also flags apps that are only a web wrapper. A TWA is Google's own way to bring a PWA to Play.
- **PWABuilder's online packager:** it makes the same TWA. It's fine as a fallback, but the project wouldn't live in the repo, so the next build couldn't be repeated.

## Consequences
- Building needs JDK 17 and the Android SDK; Bubblewrap can download both. The owner signs builds with their own key (`android/README.md`).
- The owner's tasks:
  - a Google Play developer account (a one-time fee);
  - identity verification;
  - for a new personal account, a closed test with testers before production;
  - the store's forms (data safety, content rating, app access, account deletion URL).

  `android/README.md` has the steps.
- An app update (a new version code) is needed only when `twa-manifest.json` changes: icon, name, colours, notifications. Site changes ship by deploying.
- `e2e/install.spec.ts` checks `/.well-known/assetlinks.json`; `src/core/android.test.ts` covers the fingerprints and the launch check.
