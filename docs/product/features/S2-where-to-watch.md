# S2 · Where to watch

**Stage:** 2 · **Built:** 2026-09-29 ([ADR 0032](../../decisions/0032-where-to-watch.md))

## Summary
On movie and series pages, show which streaming services carry the title **in the user's country**, with deep links. The data comes from TMDB `/watch/providers`, which is powered by JustWatch.

## Rules
- Country = profile setting (default derived from the browser locale or IP at sign-up, and editable).
- Cache provider data on `titles` with a 24h TTL.
- Show the **JustWatch attribution** required by TMDB.
- Affiliate links for buying (books, games) are **later**, see [later/affiliate-links.md](../later/affiliate-links.md).

## As built
- **Where it shows:** a "Where to watch" block on the series page (above the episodes) and on a new, small movie page, `/title/movie/[id]`. The collection's edit sheet links a movie there ("Where to watch").
- **Groups:** **Stream** (subscription), **Free** (with or without ads) and **Rent or buy**, each with at most 8 logos, in TMDB's display order.
- **Links:** each logo opens TMDB's watch page for the title in that country. TMDB's API has no per-service links; that page has JustWatch's deep links.
- **Attribution:** "Streaming data from JustWatch" (linked) sits in the block, in every state (services, none, error).
- **Country:**
  - The profile's `country`. When it isn't set, the first title page guesses it (the IP country from Vercel, else the region in `Accept-Language`) and saves it.
  - Changed from the block's country picker or Settings → Preferences → Country.
  - Without any guess, the block asks the user to choose.
- **Other states:** "Not streaming, free or for sale in Thailand right now." when the country has nothing; an error line when TMDB fails and nothing is cached.
- **Cache:** `title_providers`, one row per title with every country, refreshed after 24 hours. It streams in (Suspense), so the page never waits for TMDB.

## Acceptance criteria
- [x] A US user and a TH user see their own country's providers for the same title. (`e2e/where-to-watch.spec.ts`: an en-US browser and a th-TH browser, then a switch from the picker; `src/core/catalog/watch-providers.test.ts` with real TMDB fixtures)
- [x] Attribution is visible wherever provider logos appear. (`e2e/where-to-watch.spec.ts`)

## Data
`title_providers` (`title_id`, `providers` jsonb, `fetched_at`) · `profiles.country` (stage 1 column, now set) · migration `20260929090000_stage2_where_to_watch.sql`.
