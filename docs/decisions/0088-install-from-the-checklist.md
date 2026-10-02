# ADR 0088: Install first, from the checklist and on every phone

**Status:** Accepted · **Date:** 2026-10-03 · Follows [ADR 0046](0046-getting-started-checklist.md), [ADR 0056](0056-getting-started-button.md), [ADR 0085](0085-install-before-sign-up.md)

## Context
The getting-started checklist's last step, "Install the app", was plain text with a hint to use the browser's menu. It couldn't be tapped (the owner, 2026-10-03: "Install the app can't be tapped; make it easy, a button that installs or puts it on the home screen"). Also, on iOS the app on the home screen keeps its own storage, so Safari's checklist never learned that it had been added.

The owner then asked for installing to come first (2026-10-03): "I don't want people using it in the browser; invite them to do this first, because it's full screen like a real app. Make sure it works on iOS and Android."

## Decision
- **The step is a button.** The row and an Install pill on it both call `askToInstall()` (`src/components/pwa/browser.ts`). That fires a window event, and the install sheet (ADR 0085, mounted once in the layout) answers it for anyone, signed in or not:
  - **The browser's dialog is ready** (Chromium's `beforeinstallprompt`): it opens at once, still inside the tap. The checklist stays open and ticks the step when the person accepts.
  - **Otherwise** the checklist closes and the install sheet opens with this browser's steps: iOS Share → Add to Home Screen, an Android menu, an app's browser (open in the real one first), or, new, a **computer** (`desktop`: the address bar's install icon in Chrome or Edge, File → Add to Dock in Safari).
- **"It's on my home screen"** ("It's installed" on a computer) closes the sheet and ticks the step. We can't see an install made from the steps, so the person's word is taken. Nothing is earned from the checklist, so there's nothing to cheat. "Not now" leaves the step open. A sheet that someone asked for never counts as the 30-day "Not now", so Home's install card isn't quieted.
- **Installed on this device** (`wasInstalled` / `markInstalled`, the existing `mystonie.installed` key) is now marked from four places:
  - opening the installed app;
  - accepting the browser's dialog (the checklist, Home's card or the visitors' sheet);
  - Chromium's `appinstalled` event, which also covers the address bar's own install icon;
  - "It's on my home screen".

  Home's install card hides once it's set, and the install sheet doesn't ask.
- **An out-of-date "installed" is forgotten** when Chromium fires `beforeinstallprompt`, which it does only while the app isn't installed. It happens on Android, where a phone that once opened the installed app shares the browser's storage, even after the app is deleted. Without this, the owner's phone got no invitation and a ticked step (2026-10-03). Elsewhere (iOS) nothing tells us, so the flag stands. It's set there only by "It's on my home screen".
- `askedInstallWay` (`src/core/install.ts`) picks the way for a request. Unlike `installWay`, it treats a computer as `desktop`, not `none`, and doesn't skip automation. Nobody on a computer is asked unprompted. Analytics: `install_prompt` gains `way: "desktop"` and `requested: true`.

### Install first (the second request)
- **Everyone on a phone's browser is asked, not only visitors:**
  - Visitors are asked after 3 s (was 6 s in ADR 0085; the owner, 2026-10-03).
  - Signed-in people are asked after 1.5 s.
  - It's asked once a visit, and "Not now" quiets it and Home's card for **24 hours** (was 30 days; the owner, 2026-10-03).
  - The getting-started welcome waits while the sheet is about to ask (`installAskComing`), so installing comes before the checklist, which opens on the next page.
- **"Not now" shrinks the sheet into a floating Install button** (the owner, 2026-10-03), bottom left, above the nav island when signed in, so a mis-tap can be undone. It shows for the 24 hours the sheet stays quiet, or for the rest of the visit after a sheet someone asked for. Cancelling Chrome's own dialog does the same. Tapping it opens the browser's dialog, or the sheet. It hides once installed, in the installed app, on quiet pages and on `/import` (its own bottom bar).
- **An Install button wherever a tap can install** (the owner, 2026-10-03: "make it Install, and install"). No page can install itself without the browser's own dialog. So:
  - Android's other browsers (Firefox, Samsung Internet without its dialog ready) get **Install**. It's an intent link that opens the same page in Chrome, where Chrome's dialog does it in one tap. App browsers (LINE, Instagram, Facebook on Android) get **Open in Chrome to install**.
  - iOS has no such way for a page: the steps stay.
  - "It's on my home screen" becomes a small link, "I've added it already", under Not now. It's kept for iOS, so the checklist can tick.
- **In Chrome the sheet opens with the Install button:** when Chrome hasn't offered its dialog yet, the sheet waits up to 4 s more for it rather than open with the menu's steps.
- **Home's install card** shows on every phone that installs by hand. Its "Show me how" opens the same sheet (it used to show only on iOS, with its own copy of the steps).
- **The iOS steps fit iOS 26:**
  1. Share, behind ••• in the new Safari.
  2. Add to Home Screen, under View More if it isn't there.
  3. Keep **Open as Web App** on, so it opens full screen.

  Someone signed in is told that the home-screen app signs in once more, because iOS gives it its own storage. Every manual way gets "It's on my home screen".
- **Full screen on iOS:** the manifest's `display: standalone` does it. Next writes only `mobile-web-app-capable`, so the layout adds Apple's older `apple-mobile-web-app-capable` too.
- **Signing in inside the iOS app:** Google's own button (ADR 0073) works through a popup that talks back to the page, which a home-screen app on iOS can't do reliably. In the installed app on iOS, Google uses the redirect button like the other providers. The emailed code is typed in, so it always works there.
- **Checked:** on the live site, Chrome (Android emulation, a real profile) reports no installability errors and fires `beforeinstallprompt`. The manifest, icons (192, 512, maskable, apple-touch 180) and service worker all load. The iPhone sheet renders in WebKit 26.

**Rejected:**
- **Only the browser's dialog:** iOS has no install API, and a button that does nothing there is worse than the steps.
- **A QR code to open the site on a phone, from a computer:** it needs a new package; the desktop sheet names the address instead.
- **Blocking the site in a phone's browser until it's installed:** visitors from a shared card must see it first. In-app browsers (Instagram, LINE) can't install at all. And app stores frown on it the day we ship a native app.

## Consequences
- `e2e/install.spec.ts` covers:
  - the step on a computer, on an iPhone, and with the browser's dialog ready;
  - a signed-in iPhone asked before the welcome.

  `e2e/home.spec.ts` covers the card's "Show me how".
- What only a real phone can show:
  - the home-screen app opening full screen;
  - signing in there with each provider.

  These belong to the owner's real-device checks. It uses a stand-in session cookie and mocked counts, so it needs no Mailpit.
- Any later "Install" button (Settings, the footer) only needs to call `askToInstall()`.
