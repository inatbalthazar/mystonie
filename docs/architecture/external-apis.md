# External APIs

**Rule:** keys live on the server. The browser only calls our route handlers. Responses are normalized in `src/core/catalog` and cached in Postgres. Each provider sits behind a small interface so it can be swapped.

| Stage | Provider | Used for | Auth / env | Terms & notes |
|---|---|---|---|---|
| 0 | **TMDB** | search (`/search/multi`), `/trending/all/week` (first screen), details, seasons/episodes, images, `/trending`, localized titles, `/watch/providers` (stage 2) | `TMDB_API_TOKEN` | Free for non-commercial use with **attribution** (logo + notice). **A commercial agreement is required once Mystonie earns money (before Pro launch).** Movie/TV data comes from TMDB, not IMDb ([ADR 0001](../decisions/0001-tmdb-instead-of-imdb.md)). |
| 2 | **DoesTheDogDie** | content-warning topics + yes/no community votes per title | `DTDD_API_KEY` | Verify the current endpoints, rate limits, attribution and commercial terms in DTDD's API docs before building. Record them here. Cache ≥ 7 days. Credit + link back on every warning block ([ADR 0009](../decisions/0009-content-warnings-from-dtdd-first.md)). |
| 2 | **Google Books** | book search, cover, page count | `GOOGLE_BOOKS_API_KEY` | Page counts are sometimes missing, so handle null. |
| 2 | **AniList** (GraphQL) | manga, manhwa, webtoons (volumes, chapters, covers) | none | Rate-limited (check current limits). Cache aggressively. Jikan (MAL) is the fallback. |
| 2 | **TMDB watch providers** (JustWatch data) | where to watch by country | TMDB token | **JustWatch attribution** required. |
| 2 | **Stripe** | Pro subscription | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Entitlements come only from verified webhooks. |
| any | **PostHog**, **Sentry** | analytics, errors | `NEXT_PUBLIC_POSTHOG_KEY`, `SENTRY_DSN` | PostHog cookieless mode. |
| later | RAWG + HowLongToBeat | games | – | HLTB has no official API. Use a cached server job only ([ADR 0005](../decisions/0005-hltb-via-edge-function-cache.md)). |

## Normalized search result (`src/core/catalog`)
```ts
type SearchResult = {
  source: 'tmdb' | 'google_books' | 'anilist';
  externalId: string;
  kind: 'movie' | 'series' | 'book' | 'manga';
  name: string;
  originalName?: string;
  year?: number;
  imageUrl?: string;
  subtitle?: string; // e.g. network, author, "Anime · 2023"
};
```
