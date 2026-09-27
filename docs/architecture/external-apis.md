# External APIs

**Rule:** keys live on the server. The browser only calls our route handlers. Responses are normalized in `src/core/catalog` and cached in Postgres. Each provider sits behind a small interface so it can be swapped.

| Stage | Provider | Used for | Auth / env | Terms & notes |
|---|---|---|---|---|
| 0 | **TMDB** | search (`/search/movie` + `/search/tv`, merged by popularity), `/trending/all/week` (first screen), details, seasons/episodes, images, `/trending`, localized titles, `/watch/providers` (stage 2) | `TMDB_API_TOKEN` | Free for non-commercial use with **attribution** (logo + notice). **A commercial agreement is required once Mystonie earns money (before Pro launch).** Movie/TV data comes from TMDB, not IMDb ([ADR 0001](../decisions/0001-tmdb-instead-of-imdb.md)). |
| 2 | **DoesTheDogDie** | content-warning topics + yes/no community votes per title | `DTDD_API_KEY` | Verify the current endpoints, rate limits, attribution and commercial terms in DTDD's API docs before building. Record them here. Cache ≥ 7 days. Credit + link back on every warning block ([ADR 0009](../decisions/0009-content-warnings-from-dtdd-first.md)). |
| 2 | **Google Books** | book search, cover, page count | `GOOGLE_BOOKS_API_KEY` | Page counts are sometimes missing, so handle null. |
| 2 | **AniList** (GraphQL) | manga, manhwa, webtoons (volumes, chapters, covers) | none | Rate-limited (check current limits). Cache aggressively. Jikan (MAL) is the fallback. |
| 2 | **TMDB watch providers** (JustWatch data) | where to watch by country | TMDB token | **JustWatch attribution** required. |
| 2 | **Stripe** | Pro subscription | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Entitlements come only from verified webhooks. |
| 1 | **Resend** | Sign-in emails (`POST https://api.resend.com/emails`, from the Supabase Send Email Hook route, [ADR 0020](../decisions/0020-auth-passwordless-ssr.md)); launch email and weekly recaps ([ADR 0025](../decisions/0025-weekly-recaps.md)) through `POST https://api.resend.com/emails/batch` (≤ 100 per call, `Idempotency-Key`) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Free: 3,000/month, 100/day. Needs a verified sending domain. Every non-auth email carries `List-Unsubscribe` one-click headers. [ADR 0019](../decisions/0019-email-resend.md). |
| any | **PostHog**, **Sentry** | analytics, errors | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SENTRY_DSN` | Browser SDKs, lazy-loaded, proxied via `/ingest` and `/monitoring`. PostHog cookieless, EU. [ADR 0015](../decisions/0015-analytics-errors-uptime.md). |
| later | RAWG + HowLongToBeat | games | – | HLTB has no official API. Use a cached server job only ([ADR 0005](../decisions/0005-hltb-via-edge-function-cache.md)). |

## Our catalog routes (stage 0)
Implemented in `src/app/api/`, TMDB client in `src/data/tmdb.ts`, normalizers in `src/core/catalog/tmdb.ts` (fixture tests). Caching, limits and language: [ADR 0012](../decisions/0012-catalog-api-caching-and-limits.md).

| Route | Returns | Rate limit (per IP hash) |
|---|---|---|
| `GET /api/search?q=` (2–100 chars) | `{ results: SearchResult[] }`, movies + series, top 20 by TMDB popularity | 60/min |
| `GET /api/trending` | `{ results: SearchResult[] }`, `/trending/all/week` | 30/min |
| `GET /api/titles/tmdb/{movie\|series}/{id}` | `{ title: Title }`, cached in `titles` for 7 days | 30/min |
| `POST /api/episodes` (signed in) | Logs episodes; caches the series' seasons (`/tv/{id}/season/{n}`, all numbered seasons) in `title_episodes` first when missing or old | 120/min |
| `POST /api/entries` (signed in) | Quick add; caches the title, and for a series its episodes after responding | 60/min |

Errors are JSON `{ error }`: `400 invalid_query`, `404 not_found`, `429 rate_limited` (with `Retry-After`), `502 catalog_error`, `503 catalog_unavailable` (no `TMDB_API_TOKEN`). Attribution (logo + notice) is in the site footer (`src/components/tmdb-attribution.tsx`, logo in `public/attribution/`).

## Normalized search result (`src/core/catalog`)
```ts
type SearchResult = {
  source: 'tmdb' | 'google_books' | 'anilist';
  externalId: string;
  kind: 'movie' | 'series' | 'book' | 'manga';
  name: string;
  originalName?: string;
  year?: number;
  originalLanguage?: string;
  imageUrl?: string; // small poster (TMDB w342)
};
```
The UI composes any subtitle ("Series · 2016") from `kind` + `year` through next-intl. A picked title is a `Title` (same file, mirrors the `titles` table).
