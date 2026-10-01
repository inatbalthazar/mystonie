# F11 · Affiliate links & where to watch

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M6 · **Priority:** Revenue

## Summary
- **Affiliate links:** on book and game pages, show links to buy the title (books: Amazon Associates, Bookshop.org; manga: BookWalker; games: Humble, Fanatical, GOG. Steam has no affiliate programme; see [ADR 0049](../../decisions/0049-revenue-plan.md)). We earn a commission on purchases.
- **Where to watch:** on movie/TV pages, show which streaming services carry it **in Thailand** (Netflix, Disney+, Prime Video, etc.) with deep links.

## Rules
- Where to watch: use **TMDB `/watch/providers`** (data from JustWatch, `TH` region). Display the required JustWatch attribution. A direct JustWatch partner API is only needed if TMDB's data turns out to be insufficient.
- Affiliate link building is a pure function in `packages/core` (`buildAffiliateLinks(title, partners)`) driven by a `affiliate_partners` config table (partner, media types, URL template, tracking id, active).
- Links MUST be labelled as affiliate/sponsored (disclosure) and use `rel="sponsored noopener"`.
- Record outbound clicks (`affiliate_clicks`) for reporting. No personal data beyond user_id.

## Acceptance criteria
- [ ] A movie available on Netflix TH shows Netflix with a working link and attribution.
- [ ] A game page shows a store link (Humble, Fanatical or GOG) with a tracking parameter.
- [ ] Disabling a partner in config hides its links without a deploy.

## Data
`affiliate_partners`, `affiliate_clicks`, and watch-provider data cached on `titles` with a TTL.
