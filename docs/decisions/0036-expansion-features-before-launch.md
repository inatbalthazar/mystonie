# ADR 0036: Build the free-to-run expansion features before launch (stage 3)

**Status:** Accepted · **Date:** 2026-09-29

## Context
By 2026-09-29 every agent task in stages 0–2 was built. The remaining features lived in [product/later/](../product/later/README.md), behind "expansion gates": user numbers such as WAU ≥ 1,000.

The owner had already chosen to polish before launch instead of waiting between stages ([ADR 0016](0016-polish-before-launch.md)). Asked about the gates, the owner said again: "don't wait for users, make it as good as possible and ship that first."

## Decision
The user-number gates are no longer build gates, and a **stage 3, "the community album"**, is built before launch, in the roadmap's order:
- the social layer
- badges and the shelf
- Finisher #N and friend leaderboards
- challenges and clubs
- fuller import and export
- offline-first
- our own warnings and the quiz
- games

These features cost nothing to run on the current stack (one Next.js app + Supabase, free tiers).

Each task writes its spec into `product/features/`, starting from the old design in `product/later/` and re-checked against AGENTS.md. AGENTS.md rule 6 allows building from `later/` only for these roadmap tasks.

Still gated, and waiting for the owner's explicit go: anything that costs money, faces outward or needs new accounts or services. That covers:
- ads and affiliate links
- merch
- the Gem economy and lucky wheel
- the AI assistant (a paid API)
- the native Expo app
- travel

The pass criteria (WAU, revenue) remain success measures after launch.

## Consequences
- Launch moves after stage 3, and the product launches with a social layer, so the first users land in a fuller product.
- There is more to build and keep working before any user feedback. Keep each feature solo-sized, and keep specs and tests at the same bar as stages 1–2.
- Remote migrations for stage 3 still go out only when the owner says so.
