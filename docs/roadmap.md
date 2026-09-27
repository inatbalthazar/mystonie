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
- [ ] 🧑 Get a DTDD API key and confirm terms. Then: DTDD provider + matching + cache, avoid-topics settings, warning block + badges, Survived card. ([S2 warnings](product/features/S2-content-warnings.md), [ADR 0009](decisions/0009-content-warnings-from-dtdd-first.md)) · ⚡ high (title matching + new external API)
- [ ] Books (Google Books) + manga (AniList), reading progress, Read tab + stats. ([S2 books & manga](product/features/S2-books-manga.md)) · ⚡ high (two new catalogs, data-shape ADR for reading progress)
- [ ] Milestone cards, Monthly Recap, **Year in Review** (ship by early December). · ⚡ high (builds on the recap pipeline; many card designs)
- [ ] 🧑 TMDB commercial terms, Vercel Pro. Then: Stripe Pro subscription + premium templates. ([S2 Pro](product/features/S2-pro-subscription.md)) · ⚡ max (webhooks, entitlements, money is server-authoritative)
- [ ] Where to watch by country. ([S2 where to watch](product/features/S2-where-to-watch.md)) · ⚡ medium (one TMDB endpoint + cache + attribution)
- [ ] Letterboxd import. ([S2 import](product/features/S2-letterboxd-import.md)) · ⚡ max (messy CSVs, fuzzy matching, preview/commit)
- **Launch** after this stage. **Success measures:** WAU ≥ 1,000 · revenue covers infrastructure.

## Expansion gates
Build these **only** when the gate is met and the owner approves. Specs are in [product/later/](product/later/README.md).

| Feature | Gate |
|---|---|
| Social feed, follows, Kudos ("Stamp") | WAU ≥ 1,000 + user demand |
| Own trending data, numbered "Finisher #N" stamps, friend leaderboards | ≥ 200 logs/week on a popular title |
| Monthly challenges, fandom clubs | WAU ≥ 2,000 |
| Expo app, widgets, direct IG Stories share | WAU ≥ 3,000 or measured web-share drop-off |
| Games (RAWG + HLTB) | Top request in feature vote |
| Own timestamped warnings + quiz + Scene Alert | MAU ≥ 5,000 or DTDD data insufficient |
| Full offline sync | Users ask for it |
| Gems, wheel, merch, ads, affiliate, AI assistant, travel | MAU ≥ 20,000 + stable revenue |
