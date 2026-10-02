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
- Pages: Privacy Policy and Terms exist and are linked in the footer. **Operator / data controller:** the owner, contact `privacy@mystonie.com` (forwarded to the owner's inbox, [ADR 0087](../../decisions/0087-brand-domain.md); `hello@mystonie.com` on the Report a problem page), operator site `https://www.codenat.me/`. Both live in `src/lib/legal.ts`.

### Share & export (technical rules)
- **Pre-render the PNG** whenever the preview settles (debounced after template / size / text changes) and keep the `Blob` ready. The Share button must call `navigator.share({ files, url })` synchronously in the click handler: iOS Safari rejects a share that starts after an async render (`NotAllowedError`). Fall back to Download when `navigator.canShare({ files })` is false.
- The share payload includes `url` = site URL with `?ref=card&tpl=<template>` so visits from shared cards are attributable (the link printed on the PNG can't be tapped). The landing page records `ref` / `tpl` in the `$pageview` event and in `waitlist.source`.
- Poster images load with `crossOrigin="anonymous"` (TMDB images send `Access-Control-Allow-Origin: *`, verified 2026-09-24) so palette extraction and export don't taint the canvas.
- **Fonts:** the brand fonts load normally. Noto Sans Thai / KR / JP load **only when the review or title contains that script** (dynamic `FontFace` or `unicode-range`), and export waits for `document.fonts.ready`. As built: Thai through `unicode-range`; the KR/JP CSS itself is imported on demand ([ADR 0018](../../decisions/0018-lazy-cjk-font-css.md)).

### Abuse & privacy
- `/api/search`, `/api/trending` and the waitlist route are rate-limited per hashed IP (`rate_limits` table, salted hash with `IP_HASH_SALT`, no raw IPs stored).
- The waitlist form has a honeypot field, a consent line ("We'll email you when the app launches. Unsubscribe anytime.") and stores `consent_at`. Every email sent later has an unsubscribe link.

### Site basics
- Theme follows the system (`prefers-color-scheme`) with the shadcn `.dark` tokens. A manual toggle comes with Settings in stage 1.
- `metadataBase`, favicon + app icon (placeholder until the designer's logo), a default OG image for `/` (Latin-safe, `@vercel/og` or static PNG), `robots.txt`, `sitemap.xml` with `en` + `th` alternates.
- **As built:** dark tokens sit in `@media (prefers-color-scheme: dark)` in `globals.css` (no JS, no flash) and `viewport.themeColor` follows the theme. The site origin comes from `siteUrl()` in `src/lib/site.ts`: `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain, else `localhost:3000`. The placeholder Stonie mark is `src/app/icon.svg`; `apple-icon.tsx` (180px) and `opengraph-image.tsx` (1200×630, English copy from `en.json`, shared by every locale) render it to PNG with `next/og` at build time. To swap in the designer's logo, replace `icon.svg` (or drop in `icon.png` / `apple-icon.png` / `opengraph-image.png` files and delete the `.tsx` generators). Those generated routes have no file extension, so `src/proxy.ts` excludes them by name. New public pages must be added to `src/app/sitemap.ts`.

### First screen (as built)
`src/app/[locale]/page.tsx` loads trending on the server (`trendingTitles()`, revalidated hourly; empty if TMDB is unavailable) and passes 12 titles to `src/components/title-picker.tsx`. That client component debounces search (250 ms, ≥ 2 chars, aborts stale requests), shows a 3-column poster grid at 360px, and on pick fetches `/api/titles/tmdb/{kind}/{id}` into a details panel. The card editor replaces that panel.

### Card system (as built)
- `src/core/cards/`: `CardData`, sizes, palette from poster pixels, script detection, watch time (unit-tested).
- `src/cards/`: `registry.tsx` (`TEMPLATES`, `CardTemplate`), `templates/` (Ticket, Polaroid, Bold Stats), shared `parts.tsx` (root, poster, title sizing, stars, stats, footer), `card-preview.tsx` (scales the export-size card), `export.ts` (`renderCardPng`, `usePrerenderedCard`, `downloadBlob`), `card-studio.tsx` (the editor, see below), `example-cards.tsx` (first screen, top 3 trending titles with real stats).
- Stats: movies show runtime in minutes; series show total hours (runtime × episodes), episodes and seasons. Unknown values are left out.
- `/card-lab` (development only) renders every template × size × hard case for `pnpm test:e2e`. Decisions: [ADR 0013](../../decisions/0013-card-rendering-details.md). Templates are v1 of the agent-made design system ([ADR 0017](../../decisions/0017-design-system-v1.md)): FINISHED stamp, display type, hand-written polaroid captions.

### Card editor (as built)
`src/cards/card-studio.tsx`, fed by the picked-title panel (remounted per title, so edits don't carry over):
- **Template:** buttons, or swipe the preview left/right (≥ 40 px, mostly horizontal; `touch-action: pan-y` keeps vertical scrolling). Order wraps.
- **Size:** Story 9:16 / Post 4:5.
- **Rating:** 5 star buttons. A tap sets that many stars, tapping the same star again toggles a half star (4 → 3.5 → 4); a clear button removes it. No rating = no stars on the card.
- **Review:** one line, max 80 **visible characters** counted by grapheme (`Intl.Segmenter`), so Thai marks and emoji count once. Newlines become spaces; blank = no review.
- **Date:** native `<input type="date">` (the browser localizes the picker), default today, no future dates. The card prints it with next-intl in the page locale.
- **Share / Download:** the PNG is pre-rendered 400 ms after the last change. Share builds the `File` and calls `navigator.share({ files, url })` synchronously in the click; `url` is the current page with `?ref=card&tpl=<id>` (`cardShareUrl`). If the browser can't share files with a URL it shares the file alone; if it can't share files at all the Share button is hidden and Download is the primary action. A cancelled share does nothing; any other share error falls back to Download.
- Pure helpers (rating steps, review clamp, share URL, template cycle) live in `src/core/cards/edit.ts` with unit tests. `e2e/editor.spec.ts` drives the whole flow with a mocked `navigator.share` and checks the payload and that the share starts during the click.

### Waitlist and legal pages (as built)
- `src/components/waitlist-form.tsx`: email + hidden honeypot (`website`) + consent line with a Privacy link. Shown on the first screen until a title is picked, and in the card editor after Share / Download. Success replaces the form with "You're on the list".
- `POST /api/waitlist` (`src/app/api/waitlist/route.ts`) → `{ ok: true }` · `400 invalid_email` · `429 rate_limited` (5 per 10 min per IP hash) · `503 unavailable` (no Supabase). Validation in `src/core/waitlist.ts` (unit-tested), insert in `src/data/waitlist.ts`. Duplicates and honeypot hits answer `{ ok: true }`. `source` = `placement=home|after_card` + landing `ref`/`tpl`/`utm_*`.
- `/privacy` and `/terms` (`src/components/legal-page.tsx`), linked in the footer and listed in the sitemap. Text is English only in `messages/en.json`; contact and "last updated" date in `src/lib/legal.ts`. Decisions: [ADR 0014](../../decisions/0014-waitlist-and-legal-pages.md).

### Analytics, errors, uptime (as built)
- Events (`src/core/analytics.ts`): `card_created {kind, tpl}` when the editor opens for a title · `template_switched {tpl, via: button|swipe}` · `size_switched {size}` · `card_shared {tpl, size}` after the share sheet succeeds · `card_downloaded {tpl, size, fallback}` · `waitlist_joined {placement}`. Every event and `$pageview` carries `ref` / `tpl` from the landing URL. Pass-criterion query: share rate = cards with `card_shared` or `card_downloaded` ÷ `card_created`.
- PostHog loads after the page is idle, cookieless, through `/ingest`; Sentry (errors only, no personal data) the same way through `/monitoring`. Both are off without their env keys and Sentry is off in development.
- `GET /api/health` → `{ ok, db }` 200/503, polled by an external uptime monitor and a daily Vercel cron. Decisions: [ADR 0015](../../decisions/0015-analytics-errors-uptime.md).

## Acceptance criteria
- [x] Typing "stranger" shows *Stranger Things* with a poster before the word is complete (first result for "strang", verified 2026-09-26).
- [x] All 3 templates render at both sizes with no layout overflow for long titles (60+ chars) and long reviews (`e2e/cards.spec.ts`).
- [x] A Thai, Korean and Japanese review renders correctly on the PNG (exported and checked 2026-09-26).
- [ ] Share opens the native share sheet with the image on iOS Safari and Android Chrome (🧑 real-device check pending; payload and click timing covered by `e2e/editor.spec.ts`). Download works on desktop (verified 2026-09-26, Chrome).
- [x] Waitlist emails are stored in Supabase (`waitlist` table, unique email). Verified on local Supabase 2026-09-26: lower-cased, duplicate kept its first locale/source, re-subscribe works. Production needs the Supabase project.
- [x] Lighthouse mobile performance ≥ 90 on the card page (Noto KR/JP not downloaded when the card has only Latin/Thai text). Local production build 2026-09-26: `/` 94–95 over 5 runs (FCP 0.8 s, LCP 3.0–3.1 s, TBT 30–100 ms, CLS 0, SI 0.9 s), `/th` 93. Before: 86–88. Neither the KR/JP fonts nor their CSS load on the first screen (`e2e/cards.spec.ts`).
- [ ] First screen shows example cards and at least 8 trending titles; tapping one opens its card.
- [ ] Shared URL carries `ref=card&tpl=…`, and a visit with it shows up in PostHog with those properties.
- [x] Rapid repeated calls to `/api/search` from one client get `429`; a filled honeypot is silently dropped (both verified locally 2026-09-26; waitlist also returns `429` on the 6th try in 10 min).
- [ ] Pasting the site URL into X / Discord / LINE shows the OG preview.
- [ ] Dark mode: the page and editor are readable with the OS in dark mode.
- [ ] The events above show up in PostHog.

## Pass criteria for stage 0 (1 month after launch)
≥ 500 cards created · ≥ 30% shared or downloaded · ≥ 100 waitlist sign-ups.

## Data
`titles` (TMDB cache), `waitlist`, `rate_limits`.
