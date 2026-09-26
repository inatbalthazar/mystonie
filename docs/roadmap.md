# Roadmap

Each checkbox is sized for **one agent session / one PR**. Work top to bottom within the current stage. Tick the box in the same PR. **Don't start the next stage until the current stage's pass criteria are met and the owner says go.**

Legend: `[ ]` todo · `[x]` done · `[~]` in progress (add branch name) · 🧑 = owner task (not for agents)

## Before code (owner)
- [ ] 🧑 Secure the name **Mystonie** ([ADR 0011](decisions/0011-name-mystonie.md)): buy `mystonie.com` + `mystonie.app` (+ `mystony.com` for typos), claim `@mystonie` on TikTok / X and `@mystonieapp` on IG, run a trademark search (USPTO / WIPO, classes 9 and 42).
- [ ] 🧑 Get a TMDB API key (and later a DTDD API key). Read attribution terms.
- [ ] 🧑 Commission the freelance designer: logo, colour/type tokens, 3 card templates ([design direction](design/design-direction.md)).
- [ ] 🧑 Create Supabase, Vercel, PostHog and Sentry accounts.
- [ ] 🧑 Pick the launch title (the biggest global finale/release 4–6 weeks out).

## Stage 0: Mystonie Card (3–4 weeks) · [spec](product/features/S0-card-maker.md)
- [x] **Scaffold:** Next.js (App Router, TS strict, `src/`) + Tailwind + shadcn/ui + pnpm at the **repo root**. `create-next-app` refuses non-empty folders, so scaffold into a temp dir and merge (keep existing docs, AGENTS.md, CLAUDE.md, README.md, .gitignore). Add ESLint rule: no React/Next/DOM/Supabase imports in `src/core`. Add Vitest. ([ADR 0006](decisions/0006-single-nextjs-app.md), [ADR 0010](decisions/0010-scaffold-baseline.md))
- [x] next-intl with `en` default + `th`, locale routing, language switcher, `messages/en.json` + `th.json`. ([i18n](architecture/i18n.md), [ADR 0007](decisions/0007-english-first-global.md))
- [ ] Supabase init + first migration: `updated_at` trigger fn, `titles`, `waitlist` (with `consent_at`), `rate_limits`, RLS. ([data model](architecture/data-model.md))
- [ ] GitHub Actions CI (lint, typecheck, test) + Vercel project with preview deploys per PR. Pin Node 24 (`engines`). Add a lint rule against hard-coded JSX strings.
- [ ] Site basics: theme follows system (dark mode), `metadataBase`, placeholder favicon/app icon, default OG image, `robots.txt`, `sitemap.xml`.
- [ ] `/api/search` + `/api/trending`: TMDB multi search (movie + tv) and weekly trending, normalizer in `src/core/catalog` (fixture tests), cache chosen titles, rate limit, TMDB attribution.
- [ ] First screen: example cards + "Trending this week" chips, search-as-you-type UI with poster cards.
- [ ] Card system: template registry in `src/cards`, **Ticket / Polaroid / Bold Stats** at 9:16 and 4:5, palette from poster, Noto fallback fonts loaded only when needed. Browser PNG export (pre-rendered). Playwright screenshot tests for long titles and Thai/KR/JP reviews. Agents build v0 templates from the design direction; the designer's versions replace them. ([ADR 0008](decisions/0008-client-side-card-rendering.md))
- [ ] Card editor: rating, one-line review, date (localized), template swipe, size toggle, Share (Web Share API with file + `?ref=card` URL) / Download. Manual check on a real iPhone and Android phone.
- [ ] Waitlist form (honeypot, consent, rate limit) + Privacy Policy + Terms pages (operator contact in [S0 spec](product/features/S0-card-maker.md)).
- [ ] PostHog (cookieless) events incl. `ref`/`tpl` attribution + Sentry. Production deploy on Vercel + uptime check (also keeps the free Supabase project from pausing).
- [ ] **Update AGENTS.md "Commands"** with the real commands.
- **Pass criteria (1 month after launch):** ≥ 500 cards · ≥ 30% shared or downloaded · ≥ 100 waitlist.

## Stage 1: Collection MVP (6–8 weeks)
- [ ] Transactional email provider (ADR, default Resend) + custom SMTP for Supabase Auth. Waitlist launch email with unsubscribe.
- [ ] Auth: Google + email, `profiles` trigger (username, locale, time_zone), protected routes, account deletion. ([S1 auth](product/features/S1-auth.md))
- [ ] Migrations: `entries`, `episode_logs`, `title_episodes`, `cards`, sync columns + RLS tests.
- [ ] `src/core/stats`: `summarizeCollection`, period stats in user time zone, runtime formatting (tests).
- [ ] Quick add (≤ 3 taps) with statuses want/watching/finished and editable `finished_at`. ([S1 collections](product/features/S1-collections.md))
- [ ] Series: seasons/episodes from TMDB, episode logging, **"Next episode"** on Home.
- [ ] Collection page: tiles/list, filters, summary header.
- [ ] Celebration flow + Finish / Progress cards + Stats Sticker, card saving + `/c/[id]` share page with OG preview. ([S1 share artwork](product/features/S1-share-artwork.md))
- [ ] Weekly Recap: pg_cron → route handler per time zone, recap card, email (web push only for installed PWA).
- [ ] Stats page. ([S1 stats](product/features/S1-stats.md))
- [ ] Public profile gallery, privacy toggle, settings (language, time zone, theme), data export, report action + username blocklist. ([S1 profile](product/features/S1-profile-privacy.md))
- [ ] Home: Next episode, recent cards, TMDB trending. PWA manifest + install prompt.
- **Pass criteria:** ≥ 1,000 sign-ups · D30 retention ≥ 15% · ≥ 25% of finishes shared.

## Stage 2: Warnings, reading, revenue (2–3 months)
- [ ] 🧑 Get a DTDD API key and confirm terms. Then: DTDD provider + matching + cache, avoid-topics settings, warning block + badges, Survived card. ([S2 warnings](product/features/S2-content-warnings.md), [ADR 0009](decisions/0009-content-warnings-from-dtdd-first.md))
- [ ] Books (Google Books) + manga (AniList), reading progress, Read tab + stats. ([S2 books & manga](product/features/S2-books-manga.md))
- [ ] Milestone cards, Monthly Recap, **Year in Review** (ship by early December).
- [ ] 🧑 TMDB commercial terms, Vercel Pro. Then: Stripe Pro subscription + premium templates. ([S2 Pro](product/features/S2-pro-subscription.md))
- [ ] Where to watch by country. ([S2 where to watch](product/features/S2-where-to-watch.md))
- [ ] Letterboxd import. ([S2 import](product/features/S2-letterboxd-import.md))
- **Pass criteria:** WAU ≥ 1,000 · revenue covers infrastructure.

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
