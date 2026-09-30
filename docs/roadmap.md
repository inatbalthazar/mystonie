# Roadmap

Each checkbox is sized for **one agent session / one PR**. Work top to bottom within the current stage. Tick the box in the same PR. **Build stages 0 → 1 → 2 back to back and launch once stage 2 is done** (owner decision 2026-09-26, [ADR 0016](decisions/0016-polish-before-launch.md)): finish every agent task of a stage before starting the next, but don't wait for users or metrics in between. Pass criteria are success measures after launch, not build gates. 🧑 tasks that block an agent task (keys, contracts) don't block the rest of the stage.

Legend: `[ ]` todo · `[x]` done · `[~]` in progress (add branch name) · 🧑 = owner task (not for agents)

**Suggested Claude Opus effort** for open agent tasks (⚡ = set `/effort` before `/next-task`):
- ⚡ **medium:** UI and data work that follows existing patterns (pages, forms, settings).
- ⚡ **high:** many parts at once, a new migration with RLS, or anything touching privacy, money or time zones.
- ⚡ **max:** open-ended design choices with risky edge cases (payments, imports of messy data).

## Before code (owner)
- [ ] 🧑 Secure the name **Mystonie** ([ADR 0011](decisions/0011-name-mystonie.md)): buy `mystonie.com` + `mystonie.app` (+ `mystony.com` for typos), claim `@mystonie` on TikTok / X and `@mystonieapp` on IG, run a trademark search (USPTO / WIPO, classes 9 and 42).
- [ ] 🧑 Get a TMDB API key (and later a DTDD API key). Read attribution terms.
- [ ] 🧑 (Optional) Commission a freelance designer later to refine the agent's design system ([design direction](design/design-direction.md)).
- [ ] 🧑 Create Supabase, Vercel, PostHog and Sentry accounts.
- [ ] 🧑 Pick the launch title (the biggest global finale/release 4–6 weeks out).

## Stage 0: Mystonie Card (3–4 weeks) · [spec](product/features/S0-card-maker.md)
- [x] **Scaffold:** Next.js (App Router, TS strict, `src/`) + Tailwind + shadcn/ui + pnpm at the **repo root**. `create-next-app` refuses non-empty folders, so scaffold into a temp dir and merge (keep existing docs, AGENTS.md, CLAUDE.md, README.md, .gitignore). Add ESLint rule: no React/Next/DOM/Supabase imports in `src/core`. Add Vitest. ([ADR 0006](decisions/0006-single-nextjs-app.md), [ADR 0010](decisions/0010-scaffold-baseline.md))
- [x] next-intl with `en` default + `th`, locale routing, language switcher, `messages/en.json` + `th.json`. ([i18n](architecture/i18n.md), [ADR 0007](decisions/0007-english-first-global.md))
- [x] Supabase init + first migration: `updated_at` trigger fn, `titles`, `waitlist` (with `consent_at`), `rate_limits`, RLS. ([data model](architecture/data-model.md))
- [x] GitHub Actions CI (lint, typecheck, test + pgTAP DB tests) in `.github/workflows/ci.yml`. Vercel project `mystonie` created (Node 24). Pin Node 24 (`engines`). Lint rule against hard-coded JSX strings (`react/jsx-no-literals`).
- [ ] 🧑 Connect the Vercel project to the GitHub repo (Vercel → mystonie → Settings → Git → Connect `inatbalthazar/mystonie`), so pushes to `main` deploy production and every PR gets a preview URL. Then make the CI checks required on `main` (GitHub → Settings → Branches).
- [x] Site basics: theme follows system (dark mode), `metadataBase`, placeholder favicon/app icon, default OG image, `robots.txt`, `sitemap.xml`.
- [x] `/api/search` + `/api/trending`: TMDB multi search (movie + tv) and weekly trending, normalizer in `src/core/catalog` (fixture tests), cache chosen titles, rate limit, TMDB attribution. Plus `/api/titles/tmdb/{kind}/{id}` to cache a picked title. ([ADR 0012](decisions/0012-catalog-api-caching-and-limits.md))
- [x] First screen: "Trending this week" chips, search-as-you-type UI with poster cards, picked-title panel. (The 3 example cards moved to the card system task: they need the real templates.)
- [x] Card system: template registry in `src/cards`, 3 example cards on the first screen (one per template, sample data), **Ticket / Polaroid / Bold Stats** at 9:16 and 4:5, palette from poster, Noto fallback fonts loaded only when needed. Browser PNG export (pre-rendered). Playwright screenshot tests for long titles and Thai/KR/JP reviews. Agents build v0 templates from the design direction; the designer's versions replace them. ([ADR 0008](decisions/0008-client-side-card-rendering.md)) ([ADR 0013](decisions/0013-card-rendering-details.md))
- [x] Card editor: rating, one-line review, date (localized), template swipe, size toggle, Share (Web Share API with file + `?ref=card` URL) / Download.
- [ ] 🧑 Manual check of the card editor on a real iPhone (Safari) and Android phone (Chrome): Share opens the share sheet with the image, Download saves it, swipe changes the template.
- [x] Waitlist form (honeypot, consent, rate limit) + Privacy Policy + Terms pages (operator contact in [S0 spec](product/features/S0-card-maker.md)). ([ADR 0014](decisions/0014-waitlist-and-legal-pages.md))
- [x] PostHog (cookieless) events incl. `ref`/`tpl` attribution + Sentry. Production deploy on Vercel + uptime check (also keeps the free Supabase project from pausing). ([ADR 0015](decisions/0015-analytics-errors-uptime.md))
- [ ] 🧑 Go live: create the PostHog (EU, cookieless server hash on, discard client IP on) and Sentry (prevent storing IPs) projects, add their keys plus `SUPABASE_SERVICE_ROLE_KEY` and `TMDB_API_TOKEN` in Vercel, then an agent redeploys and smoke-tests. Add a free uptime monitor (UptimeRobot / Better Stack) on `https://<domain>/api/health` every 5 min with email alerts.
- [x] **Update AGENTS.md "Commands"** with the real commands.
- [x] **Design pass (agent-made design system):** Stonie logo + app icons (maskable), colour and type tokens (light/dark, display face for numbers), polished first screen and editor, v1 of Ticket / Polaroid / Bold Stats. Follows [design direction](design/design-direction.md); replaces the placeholder icon and the v0 templates. Keeps the card tests green. ([ADR 0017](decisions/0017-design-system-v1.md); the maskable icon comes with the PWA manifest in stage 1.)
- [x] Performance pass: Lighthouse mobile ≥ 90 on the first screen (was 86–88, now 94–95 locally). Korean/Japanese font CSS loads on demand. ([ADR 0018](decisions/0018-lazy-cjk-font-css.md))
- **Success measures (1 month after launch):** ≥ 500 cards · ≥ 30% shared or downloaded · ≥ 100 waitlist.

## Stage 1: Collection MVP (6–8 weeks)
- [x] Transactional email provider (ADR, default Resend). Waitlist launch email with unsubscribe. ([ADR 0019](decisions/0019-email-resend.md); auth emails moved to the Send Email Hook in [ADR 0020](decisions/0020-auth-passwordless-ssr.md))
- [ ] 🧑 Email go-live: create a Resend account, verify the sending domain (the brand domain once bought), add `RESEND_API_KEY`, `EMAIL_FROM`, `UNSUBSCRIBE_SECRET`, `ADMIN_SECRET` in Vercel (Sensitive). Add a postal address for the email footer before the launch send (O6).
- [x] Auth: Google + email, `profiles` trigger (username, locale, time_zone), protected routes, account deletion. ([S1 auth](product/features/S1-auth.md), [ADR 0020](decisions/0020-auth-passwordless-ssr.md))
- [ ] 🧑 Auth go-live ([ADR 0020](decisions/0020-auth-passwordless-ssr.md) → Consequences): in Supabase set the Site URL + redirect URLs (`https://<domain>/**`, the Vercel URL), add the Send Email hook to `https://<domain>/api/auth/email-hook` and put its secret in Vercel as `SEND_EMAIL_HOOK_SECRET` (Sensitive), create a Google OAuth client and enable the Google provider, add `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel. Apply the stage 1 migrations (`20260927100000_stage1_profiles.sql`, `20260927110000_stage1_collection.sql`, `20260927120000_stage1_card_images.sql`, `20260927130000_stage1_weekly_recaps.sql`, `20260927140000_stage1_stats_cards.sql`, `20260927150000_stage1_profile_privacy.sql`, `20260927160000_stage1_home_push.sql`) to the remote project (an agent can, when asked). For weekly recaps, add `CRON_SECRET` in Vercel (Sensitive) and the same value plus the site URL in Supabase Vault: `select vault.create_secret('<CRON_SECRET>', 'cron_secret'); select vault.create_secret('https://<domain>', 'app_url');` ([ADR 0025](decisions/0025-weekly-recaps.md)). Then sign in with Google on desktop and in an installed PWA (iOS + Android).
- [x] Migrations: `entries`, `episode_logs`, `title_episodes`, `cards`, sync columns + RLS tests. User tables reference `profiles(id)` with `on delete cascade` (account deletion, ADR 0020). ([ADR 0021](decisions/0021-collection-tables-rules-in-the-database.md))
- [x] `src/core/stats`: `summarizeCollection`, period stats in user time zone, runtime formatting (tests). (`src/core/stats/summary.ts`, `period.ts`; `src/core/format/runtime.ts`)
- [x] Quick add (≤ 3 taps) with statuses want/watching/finished and editable `finished_at`. ([S1 collections](product/features/S1-collections.md), [ADR 0022](decisions/0022-collection-writes-through-route-handlers.md))
- [x] Series: seasons/episodes from TMDB, episode logging, **"Next episode"** on Home. (Series page `/title/series/[id]`; "Up next" lives on `/collection` until Home exists, then moves.)
- [x] Collection page: tiles/list, filters, summary header. ([S1 collections](product/features/S1-collections.md), [ADR 0023](decisions/0023-collection-view-client-side.md))
- [x] Celebration flow + Finish / Progress cards + Stats Sticker, card saving + `/c/[id]` share page with OG preview. ([S1 share artwork](product/features/S1-share-artwork.md), [ADR 0024](decisions/0024-card-saving-and-share-links.md))
- [x] Weekly Recap: pg_cron → route handler per time zone, recap card, email. ([ADR 0025](decisions/0025-weekly-recaps.md); web push moved to the Home / PWA task)
- [x] Stats page. ([S1 stats](product/features/S1-stats.md), [ADR 0026](decisions/0026-stats-page.md)) · ⚡ medium (reuses `src/core/stats`; charts + heatmap are UI work)
- [x] Public profile gallery, privacy toggle, settings (language, time zone, theme), data export, report action + username blocklist. ([S1 profile](product/features/S1-profile-privacy.md), [ADR 0027](decisions/0027-public-profiles-preferences-reports.md))
- [x] Home: Next episode, recent cards, TMDB trending. PWA manifest + install prompt. Weekly Recap web push for installed PWAs ([ADR 0025](decisions/0025-weekly-recaps.md)). ([ADR 0028](decisions/0028-home-pwa-web-push.md))
- [ ] 🧑 Push go-live ([ADR 0028](decisions/0028-home-pwa-web-push.md)): run `pnpm push:keys` once and add `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (Sensitive) in Vercel. Then, on a real Android phone (Chrome) and an iPhone (Safari, iOS 16.4+): install from Home, open the installed app, turn on Settings → Notifications, and check that a recap notification arrives and opens the recap card (an agent can trigger one with the cron route).
- **Success measures:** ≥ 1,000 sign-ups · D30 retention ≥ 15% · ≥ 25% of finishes shared.

## Stage 2: Warnings, reading, revenue (2–3 months)
- [x] 🧑 Get a DTDD API key and confirm terms (key in `.env.local`, terms recorded in [external APIs](architecture/external-apis.md) on 2026-09-29: the free tier is non-commercial only).
- [x] DTDD provider + matching + cache, avoid-topics settings, warning block + badges, Survived card. ([S2 warnings](product/features/S2-content-warnings.md), [ADR 0009](decisions/0009-content-warnings-from-dtdd-first.md), [ADR 0035](decisions/0035-content-warnings-cache-and-survived.md)) · ⚡ high (title matching + new external API)
- [ ] 🧑 Warnings go-live ([ADR 0035](decisions/0035-content-warnings-cache-and-survived.md)): add `DTDD_API_KEY` in Vercel (Sensitive) and apply `20261001090000_stage2_content_warnings.sql` to the remote project (an agent can, when asked). Free until Pro takes money; then the DTDD Commercial tier (in the Pro go-live below).
- [x] Books (Google Books) + manga (AniList), reading progress, Read tab + stats. ([S2 books & manga](product/features/S2-books-manga.md), [ADR 0029](decisions/0029-books-manga-reading-progress.md)) · ⚡ high (two new catalogs, data-shape ADR for reading progress)
- [ ] 🧑 Books go-live ([ADR 0029](decisions/0029-books-manga-reading-progress.md)): create a Google Cloud API key restricted to the Books API (the anonymous quota is 0) and add it in Vercel as `GOOGLE_BOOKS_API_KEY` (Sensitive). Apply `20260927170000_stage2_reading.sql` to the remote project (an agent can, when asked).
- [x] Book and manga card templates: **Spine** (a book spine on a shelf) and **Manga panel** (the cover in comic panels with a speech bubble), for Finish and reading Progress cards. ([S2 books & manga](product/features/S2-books-manga.md), [ADR 0030](decisions/0030-book-manga-card-templates.md)) · ⚡ medium (two templates, card-lab hard cases)
- [x] Milestone cards, Monthly Recap, **Year in Review** (ship by early December). ([S2 milestones & recaps](product/features/S2-milestones-recaps.md), [ADR 0031](decisions/0031-milestones-monthly-recap-year-in-review.md)) · ⚡ high (builds on the recap pipeline; many card designs)
- [x] Stripe Pro subscription + premium templates, built and tested in Stripe test mode, off behind `PRO_ENABLED`: Checkout, Customer Portal, signed subscription webhooks → `subscriptions`, the Pro page, the **Film Strip** Pro template. ([S2 Pro](product/features/S2-pro-subscription.md), [ADR 0034](decisions/0034-pro-subscription.md)) · ⚡ max (webhooks, entitlements, money is server-authoritative)
- [ ] 🧑 Pro go-live ([ADR 0034](decisions/0034-pro-subscription.md)): TMDB commercial terms, Vercel Pro and the DTDD Commercial tier (all needed before taking money), a refund policy in Terms. In Stripe: products with a monthly and a yearly price (USD), a webhook endpoint `https://<domain>/api/billing/webhook` for `customer.subscription.created`, `.updated` and `.deleted`, and the Customer Portal (cancel at period end, switch plans, update card). In Vercel (Sensitive): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, then `PRO_ENABLED=true`. Apply `20260930090000_stage2_pro.sql` to the remote project (an agent can, when asked). Checkout, the webhook and the Customer Portal were already tried end to end locally with the owner's Stripe **test** keys (2026-09-29): create live-mode products, the webhook endpoint and the portal settings again, since test-mode ones don't carry over.
- [x] Where to watch by country. ([S2 where to watch](product/features/S2-where-to-watch.md), [ADR 0032](decisions/0032-where-to-watch.md)) · ⚡ medium (one TMDB endpoint + cache + attribution)
- [x] Letterboxd import. ([S2 import](product/features/S2-letterboxd-import.md), [ADR 0033](decisions/0033-letterboxd-import.md)) · ⚡ max (messy CSVs, fuzzy matching, preview/commit)
- **Success measures (after launch):** WAU ≥ 1,000 · revenue covers infrastructure.

## Stage 3: The community album, before launch
The owner's call on 2026-09-29: don't wait for users, make the product as good as possible first ([ADR 0036](decisions/0036-expansion-features-before-launch.md)). These were expansion features gated on user numbers; they are now built before launch, in this order. Each task writes its spec into `product/features/` (starting from the old design in [product/later/](product/later/README.md), re-checked against AGENTS.md).
- [x] Follows, the Following feed, **Stamps** (kudos on a finish), blocks, find people. ([S3 social](product/features/S3-social.md)) · ⚡ high (RLS across users, blocks, a feed RPC)
- [x] Badges ("stickers" earned from what you finish) and the **Shelf** on public profiles. ([S3 badges & shelf](product/features/S3-badges-shelf.md), [ADR 0038](decisions/0038-badges-and-shelf.md)) · ⚡ high (badge catalogue, server-side awards)
- [x] **Finisher #N** stamps on finish cards, trending from our own logs, friend leaderboards. ([S3 finishers & the board](product/features/S3-finishers-board.md), [ADR 0039](decisions/0039-finishers-trending-board.md)) · ⚡ high (numbering must be race-free)
- [x] Monthly challenges (patches, the Calendar Challenge card) and fandom clubs. ([S3 challenges & clubs](product/features/S3-challenges-clubs.md), [ADR 0040](decisions/0040-challenges-and-clubs.md)) · ⚡ high
- [x] Import from Goodreads, MyAnimeList and TV Time; CSV export. ([S3 import & export](product/features/S3-import-export.md), [ADR 0041](decisions/0041-import-export.md)) · ⚡ max (messy files, three matchers)
- [x] Offline-first: the app opens and logs offline, then syncs. ([S3 offline](product/features/S3-offline.md), [ADR 0042](decisions/0042-offline-first.md), [offline sync](architecture/offline-sync.md)) · ⚡ max
- [x] Our own timestamped warnings (S02E05 · 00:41) with votes, and the warnings quiz (no Gems: those stay gated). ([S3 warnings & quiz](product/features/S3-warnings-quiz.md), [ADR 0043](decisions/0043-scene-warnings-and-quiz.md)) · ⚡ max
- [ ] 🧑 Games ([ADR 0044](decisions/0044-games-rawg.md)): ~~get a RAWG API key~~ (done 2026-09-30, in `.env.local`) and add it in Vercel as `RAWG_API_KEY` (Sensitive), and in `.env.local` to try game search locally. Confirm the commercial terms before Pro takes money: RAWG's pricing says the free plan is non-commercial, its API terms say free under 100,000 MAU (ask api@rawg.io if unsure). ~~Decide on HowLongToBeat~~: no scraper; ask HowLongToBeat (contact form on howlongtobeat.com) for permission, and until then games show RAWG's average playtime (ADR 0044). Apply `20261008090000_stage3_games.sql` to the remote project (an agent can, when asked; the remote still has only the stage 0 migrations, so this comes with the full go-live).
- [x] Games (RAWG, + HowLongToBeat if the owner approves it). ([S3 games](product/features/S3-games.md), [ADR 0044](decisions/0044-games-rawg.md); HowLongToBeat only with its permission, no scraper) · ⚡ high (a fifth catalog)
- **Launch** after this stage. **Success measures:** WAU ≥ 1,000 · revenue covers infrastructure.

## Still gated (owner's go needed)
These cost money, face outward or need new accounts, so they wait for the owner's explicit go even before launch. Specs are in [product/later/](product/later/README.md).

| Feature | Why it waits |
|---|---|
| Native app (Expo), widgets, direct IG Stories share | App Store / Play fees and a new runtime (ADR needed) |
| Gems, lucky wheel, merch store | A virtual economy and physical goods; Pro comes first |
| Native ads, affiliate links | Outward-facing; hurts the polish before launch |
| AI assistant | A paid API per use |
| Travel module | Not core ([open questions](open-questions.md)) |
