# S0 · Mystonie Card: card maker (no login)

**Stage:** 0 · **Goal:** prove that people want to make and share the card before building the full app.

## Summary
A single-page web tool: search a movie or series, pick one of 3 templates, optionally add a rating and a one-line review, then download or share the image. No account needed. A waitlist form collects emails for the full collection app.

## User flow
0. **First screen (before typing):** one line of what Mystonie does, 3 example cards (one per template) and **"Trending this week"** chips from TMDB `/trending/all/week` (movies + TV). Tapping a chip = picking that title, so a first card needs no typing.
1. Type a title → results appear **while typing** (debounced ~250 ms, from 2 characters) as poster cards (TMDB `/search/multi`, movies + TV only).
2. Tap a result → the card preview renders immediately with the default template.
3. Swipe or tap to switch between **Ticket · Polaroid · Bold Stats**, and toggle the size **9:16 / 4:5**.
4. Optional: star rating (0.5–5), one-line review (max 80 chars, any language), finished date (default today, in the user's locale).
5. **Share** (Web Share API with the PNG file) or **Download**.
6. After sharing or downloading: "Save all your cards in one collection. Join the waitlist" email form.

## Rules
- Card rendering happens **in the browser** (component → PNG). See [ADR 0008](../../decisions/0008-client-side-card-rendering.md). The output must render Latin, Thai, Korean and Japanese text correctly (Noto fallback fonts).
- Poster colour palette: extract the dominant colours for the template background (client-side from the TMDB image, or server-side and cached).
- The card footer always shows `mystonie` + a short link to the site (growth loop). No QR code.
- TMDB calls go through our route handler (`/api/search`). The API key stays server-side. Show TMDB attribution on the page.
- UI strings go through next-intl. `en` is the default, `th` is available ([i18n](../../architecture/i18n.md)).
- Track PostHog events: `card_created`, `template_switched`, `size_switched`, `card_shared`, `card_downloaded`, `waitlist_joined`. Use cookieless mode (no consent banner needed).
- Pages: Privacy Policy and Terms exist and are linked in the footer. **Operator / data controller:** the owner, contact `inatbalthazar@gmail.com`, operator site `https://www.codenat.me/`. Keep the contact email in one config constant so it can switch to `privacy@<mystonie domain>` (forwarding to the same inbox) once the domain is bought.

### Share & export (technical rules)
- **Pre-render the PNG** whenever the preview settles (debounced after template / size / text changes) and keep the `Blob` ready. The Share button must call `navigator.share({ files, url })` synchronously in the click handler: iOS Safari rejects a share that starts after an async render (`NotAllowedError`). Fall back to Download when `navigator.canShare({ files })` is false.
- The share payload includes `url` = site URL with `?ref=card&tpl=<template>` so visits from shared cards are attributable (the link printed on the PNG can't be tapped). The landing page records `ref` / `tpl` in the `$pageview` event and in `waitlist.source`.
- Poster images load with `crossOrigin="anonymous"` (TMDB images send `Access-Control-Allow-Origin: *`, verified 2026-09-24) so palette extraction and export don't taint the canvas.
- **Fonts:** the brand fonts load normally. Noto Sans Thai / KR / JP load **only when the review or title contains that script** (dynamic `FontFace` or `unicode-range`), and export waits for `document.fonts.ready`.

### Abuse & privacy
- `/api/search`, `/api/trending` and the waitlist route are rate-limited per hashed IP (`rate_limits` table, salted hash with `IP_HASH_SALT`, no raw IPs stored).
- The waitlist form has a honeypot field, a consent line ("We'll email you when the app launches. Unsubscribe anytime.") and stores `consent_at`. Every email sent later has an unsubscribe link.

### Site basics
- Theme follows the system (`prefers-color-scheme`) with the shadcn `.dark` tokens. A manual toggle comes with Settings in stage 1.
- `metadataBase`, favicon + app icon (placeholder until the designer's logo), a default OG image for `/` (Latin-safe, `@vercel/og` or static PNG), `robots.txt`, `sitemap.xml` with `en` + `th` alternates.
- **As built:** dark tokens sit in `@media (prefers-color-scheme: dark)` in `globals.css` (no JS, no flash) and `viewport.themeColor` follows the theme. The site origin comes from `siteUrl()` in `src/lib/site.ts`: `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain, else `localhost:3000`. The placeholder Stonie mark is `src/app/icon.svg`; `apple-icon.tsx` (180px) and `opengraph-image.tsx` (1200×630, English copy from `en.json`, shared by every locale) render it to PNG with `next/og` at build time. To swap in the designer's logo, replace `icon.svg` (or drop in `icon.png` / `apple-icon.png` / `opengraph-image.png` files and delete the `.tsx` generators). Those generated routes have no file extension, so `src/proxy.ts` excludes them by name. New public pages must be added to `src/app/sitemap.ts`.

### First screen (as built)
`src/app/[locale]/page.tsx` loads trending on the server (`trendingTitles()`, revalidated hourly; empty if TMDB is unavailable) and passes 12 titles to `src/components/title-picker.tsx`. That client component debounces search (250 ms, ≥ 2 chars, aborts stale requests), shows a 3-column poster grid at 360px, and on pick fetches `/api/titles/tmdb/{kind}/{id}` into a details panel. The card editor replaces that panel.

## Acceptance criteria
- [x] Typing "stranger" shows *Stranger Things* with a poster before the word is complete (first result for "strang", verified 2026-09-26).
- [ ] All 3 templates render at both sizes with no layout overflow for long titles (60+ chars) and long reviews.
- [ ] A Thai, Korean and Japanese review renders correctly on the PNG.
- [ ] Share opens the native share sheet with the image on iOS Safari and Android Chrome. Download works on desktop.
- [ ] Waitlist emails are stored in Supabase (`waitlist` table, unique email).
- [ ] Lighthouse mobile performance ≥ 90 on the card page (Noto KR/JP not downloaded when the card has only Latin/Thai text).
- [ ] First screen shows example cards and at least 8 trending titles; tapping one opens its card.
- [ ] Shared URL carries `ref=card&tpl=…`, and a visit with it shows up in PostHog with those properties.
- [ ] Rapid repeated calls to `/api/search` from one client get `429`; a filled honeypot is silently dropped.
- [ ] Pasting the site URL into X / Discord / LINE shows the OG preview.
- [ ] Dark mode: the page and editor are readable with the OS in dark mode.
- [ ] The events above show up in PostHog.

## Pass criteria for stage 0 (1 month after launch)
≥ 500 cards created · ≥ 30% shared or downloaded · ≥ 100 waitlist sign-ups.

## Data
`titles` (TMDB cache), `waitlist`, `rate_limits`.
