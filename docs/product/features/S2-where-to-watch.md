# S2 · Where to watch

**Stage:** 2

## Summary
On movie and series pages, show which streaming services carry the title **in the user's country**, with deep links. The data comes from TMDB `/watch/providers`, which is powered by JustWatch.

## Rules
- Country = profile setting (default derived from the browser locale or IP at sign-up, and editable).
- Cache provider data on `titles` with a 24h TTL.
- Show the **JustWatch attribution** required by TMDB.
- Affiliate links for buying (books, games) are **later**, see [later/affiliate-links.md](../later/affiliate-links.md).

## Acceptance criteria
- [ ] A US user and a TH user see their own country's providers for the same title.
- [ ] Attribution is visible wherever provider logos appear.
