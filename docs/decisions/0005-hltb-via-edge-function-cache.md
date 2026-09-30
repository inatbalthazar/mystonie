# ADR 0005: Game data from RAWG, HowLongToBeat times via a cached Edge Function

**Status:** Superseded by [ADR 0044](0044-games-rawg.md) (games from RAWG, built in stage 3; no HowLongToBeat scraper) · **Date:** 2026-09-23

## Context
The spec wants Main Story and Completionist times from HowLongToBeat (HLTB). HLTB has no official API. Its internal search endpoint changes occasionally and blocks heavy traffic. RAWG provides game metadata plus an average `playtime`.

## Decision
- **RAWG** is the primary game source (search, metadata, covers, `playtime`).
- HLTB data is fetched **only** by the Supabase Edge Function `hltb-lookup`: match by name (+ year), store in `hltb_cache` with `fetched_at`, and refresh after a TTL (30 days) or on a miss.
- Clients never call HLTB. If HLTB fails or has no match, show RAWG `playtime` labelled "average playtime".

## Consequences
- The scraper can break and needs monitoring (log failures, alert on a high miss rate).
- ToS risk is noted in [open questions](../open-questions.md). The fallback keeps the feature usable if HLTB must be dropped.
