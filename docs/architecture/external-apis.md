# External APIs

**Rule:** keys live on the server. The browser only calls our route handlers. Responses are normalized in `src/core/catalog` and cached in Postgres. Each provider sits behind a small interface so it can be swapped.

| Stage | Provider | Used for | Auth / env | Terms & notes |
|---|---|---|---|---|
| 0 | **TMDB** | search (`/search/movie` + `/search/tv`, merged by popularity), `/trending/all/week` (first screen), details, seasons/episodes, images, `/trending`, localized titles, `/watch/providers` (stage 2) | `TMDB_API_TOKEN` | Free for non-commercial use with **attribution** (logo + notice). **A commercial agreement is required once Mystonie earns money (before Pro launch).** Movie/TV data comes from TMDB, not IMDb ([ADR 0001](../decisions/0001-tmdb-instead-of-imdb.md)). |
| 2 | **DoesTheDogDie** | content-warning topics + yes/no community votes per title | `DTDD_API_KEY` | Verify the current endpoints, rate limits, attribution and commercial terms in DTDD's API docs before building. Record them here. Cache ≥ 7 days. Credit + link back on every warning block ([ADR 0009](../decisions/0009-content-warnings-from-dtdd-first.md)). |
| 2 | **Google Books** | book search (`/volumes?q=&printType=books`), details (`/volumes/{id}`), page count, cover | `GOOGLE_BOOKS_API_KEY` | **Required:** the anonymous quota is 0 queries a day (checked 2026-09-27); without the key book search answers 503 and "All" leaves books out. Page counts are sometimes missing (null). Covers (`books.google.com/books/content`) come without CORS headers, so we serve them from `/api/covers/[volumeId]` ([ADR 0029](../decisions/0029-books-manga-reading-progress.md)). |
| 2 | **AniList** (GraphQL) | manga, manhwa, webtoons (volumes, chapters, covers) | none | POST only, about 30 requests/min (`X-RateLimit-Limit: 30`, checked 2026-09-27): responses are cached a day in Next's fetch cache (`force-cache`). Chapters/volumes are null while a series runs. Covers on `s4.anilist.co` send CORS headers. Jikan (MAL) is the fallback if limits bite. |
| 2 | **TMDB watch providers** (JustWatch data) | where to watch by country | TMDB token | **JustWatch attribution** required. |
| 2 | **Stripe** | Pro subscription | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Entitlements come only from verified webhooks. |
| 1 | **Resend** | Sign-in emails (`POST https://api.resend.com/emails`, from the Supabase Send Email Hook route, [ADR 0020](../decisions/0020-auth-passwordless-ssr.md)); launch email and weekly recaps ([ADR 0025](../decisions/0025-weekly-recaps.md)) through `POST https://api.resend.com/emails/batch` (≤ 100 per call, `Idempotency-Key`) | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Free: 3,000/month, 100/day. Needs a verified sending domain. Every non-auth email carries `List-Unsubscribe` one-click headers. [ADR 0019](../decisions/0019-email-resend.md). |
| any | **PostHog**, **Sentry** | analytics, errors | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SENTRY_DSN` | Browser SDKs, lazy-loaded, proxied via `/ingest` and `/monitoring`. PostHog cookieless, EU. [ADR 0015](../decisions/0015-analytics-errors-uptime.md). |
| later | RAWG + HowLongToBeat | games | – | HLTB has no official API. Use a cached server job only ([ADR 0005](../decisions/0005-hltb-via-edge-function-cache.md)). |

## Our catalog routes (stage 0)
Implemented in `src/app/api/`, TMDB client in `src/data/tmdb.ts`, normalizers in `src/core/catalog/tmdb.ts` (fixture tests). Caching, limits and language: [ADR 0012](../decisions/0012-catalog-api-caching-and-limits.md).

| Route | Returns | Rate limit (per IP hash) |
|---|---|---|
| `GET /api/search?q=` (2–100 chars) `&type=all\|screen\|book\|manga` | `{ results: SearchResult[] }`. No type = `screen`: movies + series, top 20 by TMDB popularity (the card maker). `book` Google Books, `manga` AniList. `all` (the collection's sheet) merges the three by name match, catalogs taking turns (`mergeSearch`), leaving out a catalog that fails | 60/min |
| `GET /api/trending` | `{ results: SearchResult[] }`, `/trending/all/week` | 30/min |
| `GET /api/titles/tmdb/{movie\|series}/{id}` | `{ title: Title }`, cached in `titles` for 7 days | 30/min |
| `POST /api/episodes` (signed in) | Logs episodes; caches the series' seasons (`/tv/{id}/season/{n}`, all numbered seasons) in `title_episodes` first when missing or old | 120/min |
| `POST /api/entries` (signed in) | Quick add (any kind); caches the title from its catalog, and for a series its episodes after responding | 60/min |
| `POST /api/reading` (signed in) | Logs a reading checkpoint (`{ id, kind, externalId, unit, position }`); caches the book or manga first; `PATCH /api/reading/[id]` un-logs | 120/min |
| `GET /api/covers/[volumeId]` (`?size=large`) | A Google Books cover from our origin (300 / 575 px), CDN-cached a month; fetches only Google's cover endpoint | – |

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
  imageUrl?: string; // small poster (TMDB w342, AniList medium, our book cover proxy)
  creator?: string; // a book's first author
};
```
The UI composes any subtitle ("Series · 2016") from `kind` + `year` through next-intl. A picked title is a `Title` (same file, mirrors the `titles` table).
