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

## Template
```md
# ADR NNNN: <decision>

**Status:** Proposed | Accepted | Deferred | Superseded by NNNN · **Date:** YYYY-MM-DD

## Context
## Decision
## Consequences
```
