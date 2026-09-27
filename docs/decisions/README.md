# Architecture Decision Records

One file per decision: `NNNN-short-slug.md`, numbered in order. Write one whenever you pick between real alternatives (a library, a data shape, a rule interpretation), so the next agent doesn't re-litigate it. Never delete an ADR. Mark it superseded instead.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-tmdb-instead-of-imdb.md) | TMDB instead of IMDb for movie/TV data | Accepted |
| [0002](0002-monorepo-with-shared-core.md) | pnpm monorepo with shared packages | Superseded by 0006 |
| [0003](0003-server-authoritative-economy.md) | Server-authoritative money, rewards, payments | Accepted (stage 2+) |
| [0004](0004-offline-first-sync.md) | Offline-first sync engine | Deferred (data rules active) |
| [0005](0005-hltb-via-edge-function-cache.md) | RAWG + HLTB via cached server job | Deferred (games gated) |
| [0006](0006-single-nextjs-app.md) | One Next.js app + Supabase | **Accepted** |
| [0007](0007-english-first-global.md) | English-first global product, Thai optional | **Accepted** |
| [0008](0008-client-side-card-rendering.md) | Render share cards in the browser | **Accepted** |
| [0009](0009-content-warnings-from-dtdd-first.md) | Content warnings from the DoesTheDogDie API first | **Accepted** |
| [0010](0010-scaffold-baseline.md) | Scaffold baseline: Next.js 16, shadcn/ui on Base UI, Vitest | **Accepted** |
| [0011](0011-name-mystonie.md) | Product name Mystonie, mascot Stonie | **Accepted** |
| [0012](0012-catalog-api-caching-and-limits.md) | Catalog API: title identity, English titles, caching, rate limits | **Accepted** |
| [0013](0013-card-rendering-details.md) | Card system: modern-screenshot, lazy Noto fonts, palette, layout tests | **Accepted** |
| [0014](0014-waitlist-and-legal-pages.md) | Waitlist: consent on submit, placements, duplicate/honeypot answers; English-only legal pages | **Accepted** |
| [0015](0015-analytics-errors-uptime.md) | Cookieless PostHog (EU) + Sentry errors-only, lazy-loaded, same-origin proxies; `/api/health` uptime | **Accepted** |
| [0016](0016-polish-before-launch.md) | Build stages 0–2 before launch; agent-made design system | **Accepted** |
| [0017](0017-design-system-v1.md) | Design system v1: warm neutrals + stamp coral, Bricolage / Geist / Caveat, Stonie logo, cards v1 | **Accepted** |
| [0018](0018-lazy-cjk-font-css.md) | Korean/Japanese font CSS loads on demand; no Geist Mono; static Caveat (Lighthouse 94–95) | **Accepted** |
| [0019](0019-email-resend.md) | Resend for app email (auth SMTP part superseded by 0020); launch email in batches from our route; signed one-click unsubscribe | **Accepted** |
| [0020](0020-auth-passwordless-ssr.md) | Passwordless sign-in (email code + link, Google PKCE), cookie sessions via `@supabase/ssr`, auth emails through the Send Email Hook, profiles trigger, self-service deletion | **Accepted** |
| [0022](0022-collection-writes-through-route-handlers.md) | Collection writes through `POST/PATCH /api/entries` (title cache + entry in one request, RLS via `userClient()`), optimistic UI, adding an existing title updates it, native `<dialog>` sheets | **Accepted** |
| [0023](0023-collection-view-client-side.md) | Collection page filters, sorts and sums in the browser (`src/core/collection/view.ts`, header = sum of rows); tiles/list remembered per device in `localStorage` | **Accepted** |
| [0024](0024-card-saving-and-share-links.md) | Saved cards: template metadata in core, `POST /api/cards` (server prints the username), public `cards` bucket written only via signed upload URLs, synchronous share with `/c/[id]`, `next/og` Latin-safe previews, Progress card offers at 25/50/75 % | **Accepted** |
| [0025](0025-weekly-recaps.md) | Weekly recaps: hourly pg_cron → `/api/cron/weekly-recaps` (pg_net, Vault secrets), due users picked in SQL (local Monday from 09:00, Monday–Sunday weeks), stats snapshot in `weekly_recaps`, email with a link to the browser-rendered recap card (Collage template), per-list signed unsubscribe, web push deferred to the PWA | **Accepted** |
| [0026](0026-stats-page.md) | Stats page: `statsReport` in `src/core` (headline = collection summary), server-rendered CSS heatmap and month bars instead of Recharts, "Share stats" as a new `stats` card kind (recap snapshot with a `period`) | **Accepted** |
| [0027](0027-public-profiles-preferences-reports.md) | Public profiles, saved preferences and reports: `public_profile()` / `shared_card()` security definer reads (shared cards of private profiles no longer listable), name blocklist as a DB trigger, `mystonie_prefs` cookie mirroring the saved language/theme for signed-in users (proxy redirect + pre-paint theme script), `reports` table with operator email, JSON export | **Accepted** |
| [0028](0028-home-pwa-web-push.md) | Home (`/home`, signed-in landing: up next, recent cards, trending → quick add), manifest + build-time icons, install prompt, notification-only service worker, recap web push only in the installed app, VAPID + aes128gcm on Web Crypto instead of `web-push`, server-only `push_subscriptions` with a push-service allowlist | **Accepted** |
| [0029](0029-books-manga-reading-progress.md) | Books (Google Books) and manga (AniList): `reading_logs` checkpoints (a sibling of `episode_logs`, Q3), title length columns, `/api/search?type=` with a name-match merge for All, Google covers through `/api/covers/[id]` (no CORS upstream), Watch · Read tabs with `titleRead` as the one source of reading numbers, estimated reading time, reading Progress cards (`cards.reading_log_id`) | **Accepted** |
| [0021](0021-collection-tables-rules-in-the-database.md) | Collection tables enforce the day-one rules in the DB: UUID v7 check, no client DELETE, column grants, composite FKs for card ownership, public-profile reads via `private.is_public_profile` | **Accepted** |

## Template
```md
# ADR NNNN: <decision>

**Status:** Proposed | Accepted | Deferred | Superseded by NNNN · **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```
