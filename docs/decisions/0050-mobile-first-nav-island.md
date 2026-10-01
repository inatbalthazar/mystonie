# ADR 0050: Mobile-first: the phone is the main screen, and a floating nav island is the app's navigation

**Status:** Accepted. Its tabs are replaced by [ADR 0053](0053-feed-tab-stats-in-me.md): Feed instead of Stats, and Stats is a tab of Me · **Date:** 2026-10-01

## Context
The owner (2026-10-01): Mystonie is a website, but people will use it on their phones, so the product should put mobile first above everything else. They asked for a floating "nav island" at the bottom, like the one in the Mesh app, adapted to our style. The docs already said "mobile-first at 360px" and planned a bottom tab bar (Home · Collection · ➕ · Me, a side rail from 1024px), but it was never built: signed-in pages had a row of round links in the header (➕, Home, Collection, Stats, account), out of thumb reach on a phone. The collection page had its own floating ➕. The core loop starts with ➕ (log in ≤ 3 taps), so on a phone the ➕ should sit under the thumb on every page.

## Decision
**The phone is the main screen.** We design and check every page at 360–430px first. Tablets and desktops get the same single column (`max-w-2xl`), centred, not a separate desktop design. The installed app (PWA, standalone) is the best place to use Mystonie, and the web page should feel like it.

**The nav island** (`src/components/nav-island.tsx`) is the navigation for signed-in users on every page, at every width:
- A frosted paper pill (`bg-card` at 80% with a backdrop blur, a hairline ring, a soft shadow) floats 24px above the bottom edge, or 8px above the home indicator (`env(safe-area-inset-bottom)`, with `viewport-fit=cover`). A strip of coral tape holds it to the page, like the photos and notes in the album. The page fades out behind it.
- **Home · Collection · ➕ · Stats · Me.** On phones the tabs show icons only, as in the Mesh example; their names are for screen readers. From 640px the names show under the icons. The tab you're on gets a darker, heavier icon, a strip of coral tape under it and `aria-current="page"` (`navTab` in `src/core/nav.ts`). Stats stays lit for Year in Review, and Me stays lit for Settings.
- **➕ in the middle** is a coral rubber stamp (quick add). From any page it opens `/collection?add=1`. On the collection page it opens quick add in place: it sends a cancelable `mystonie:quick-add` event, the collection cancels it, and there's no trip to the server. This also works offline. A tap before the collection page is ready is kept for 10 seconds and opens quick add once the page is ready (`takePendingQuickAdd`), so a second tap never races a page load. The collection's own floating ➕ is gone, and so is the collection view's `key` from `?add=1`. That key meant the refresh after a save remounted the page once closing quick add had dropped `?add=1` from the URL. The Finish card then vanished a second after it appeared whenever ➕ was tapped on another page (the old header ➕ did the same).
- **Me** opens `/me`: your own album, the page visitors see at `/u/<username>`, with Share my collection and a Settings button. It opens even while the profile is private to everyone else, and then says so.
- The island is in every page's HTML and shown by CSS. A pre-paint script (`SIGNED_IN_SCRIPT` in `src/core/auth.ts`, run with the theme script) marks `<html data-auth>` when a session cookie is present, and the `signed-in:` / `signed-out:` variants show the island or the header's Sign in. Public pages stay static, and nothing pops in after hydration. Sign-in and sign-out load a new page, so the mark is always current.
- **Pages keep room for it.** `--island-space` (0 when signed out) is the body's bottom padding and `scroll-padding-bottom`. The sticker toast and the import page's sticky bar sit above it.
- **It steps aside for the keyboard.** On touch screens it hides while a text field has focus, because fixed bars ride up oddly over the iOS keyboard.
- The header keeps only the logo, plus Sign in when signed out.
- The Next.js development badge moves to the top right (development only).

**Mobile rules for every page** (listed in the [design direction](../design/design-direction.md)): thumb-reach primary actions, touch targets ≥ 44px, text fields at 16px or larger (so iOS doesn't zoom), bottom sheets for pickers and forms (`Sheet`), nothing that needs hover, safe areas for anything fixed, dark mode checked, e2e on a phone (Playwright's Pixel 7) and screenshots at 360px.

Rejected:
- **A side rail on desktop.** It would be a second navigation to build and test. On a wide screen the island works like a dock and carries its labels.
- **A fifth "More" tab, as in Mesh.** Home already leads to the feed, the board, challenges, clubs, the reel and the quiz. Stats is a core tab ("Strava for shows").
- **Labels on phones.** They would make a taller bar. The owner's reference has none, and the four icons are common ones.
- **Hiding the island on scroll.** It adds motion, and people can lose track of it.
- **A global quick add on every page.** It needs the collection's state (the outbox, the celebration, milestones), so ➕ goes to the collection.
- **Showing the island from the session on the server.** Reading cookies in the layout would make every public page dynamic.

## Consequences
- Signed-in pages lose about 5.25rem at the bottom, and every page must keep working with the island over its last 5rem. New fixed or sticky elements at the bottom use `--island-space`.
- `/me` is protected (`PROTECTED_PATHS`). `/u/<own name>` still shows what visitors see: for a private profile, the private page with the owner's note.
- e2e tests find the navigation with `navIsland(page)` (`e2e/helpers.ts`) instead of the header; `e2e/nav.spec.ts` covers the island.
- A real iPhone (Safari and installed) and a real Android phone (Chrome and installed) should check the home indicator gap, the keyboard and the fade. That's the owner's real-device check.
