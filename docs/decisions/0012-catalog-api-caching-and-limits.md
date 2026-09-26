# ADR 0012: Catalog API: title identity, English titles, caching and rate limits

**Status:** Accepted · **Date:** 2026-09-26

## Context
Stage 0 exposes TMDB search, weekly trending and title details through our own route handlers. Several choices had real alternatives: how a title is keyed, which language the titles come in, where responses are cached, and what happens when the rate limiter's database is unreachable.

## Decision
- **Title identity is `(source, kind, external_id)`.** TMDB movie and TV ids are separate namespaces (movie `1399` ≠ tv `1399`), so the first migration's `unique (source, external_id)` was replaced (migration `…_titles_unique_per_kind.sql`). URLs use our kind names: `/api/titles/tmdb/{movie|series}/{id}`.
- **English titles for every locale in stage 0** (`language=en-US`). For a missing translation TMDB returns the original-language title (e.g. Korean for a K-drama), which a Thai visitor reads worse than English. Localized titles can come later with a per-title fallback chain.
- **Caching in three layers, no new service:** TMDB responses in Next's fetch cache (search and details 1 day, trending 1 hour); picked titles in Postgres `titles` for 7 days (served stale if TMDB fails); HTTP `Cache-Control` on our responses (search `private, max-age=300`, trending `public, s-maxage=3600`).
- **Rate limits per salted IP hash** via `rate_limit_hit()`: search 60/min, trending 30/min, title details 30/min. It **fails open** (allows) when Supabase isn't configured or errors, because search staying up matters more than strict limiting. TMDB itself is not called for rejected requests.
- **Search calls `/search/movie` and `/search/tv` in parallel and merges them by popularity**, not `/search/multi`. Verified 2026-09-26: `/search/multi` also returns people, which fill all 20 slots for partial words ("strang" → only actors), while `/search/tv` returns *Stranger Things* from "stra".

## Consequences
- Series episode data (seasons, per-episode runtime) is not fetched yet; `runtime_min` for a series is the typical episode runtime.
- The fetch cache and the `titles` table can briefly disagree; the table wins once a title is picked.
- If abuse appears while Supabase is down, add a stricter fallback (see Q9 in [open questions](../open-questions.md)).
