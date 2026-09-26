# Mystonie

> **Strava for the shows and movies you finish.**

Log every movie, series and episode you watch, and get beautiful, shareable artwork with your stats, ready for Stories. Your cards become your collection. Later, Mystonie also warns you about scenes you'd rather avoid.

*Finished it? Mystonie it.*

**Status:** planning complete. Building **Stage 0: Mystonie Card** (a card maker, no login needed).

## Repo map
```
src/               Next.js app (App Router): app/, components/, lib/, later cards/, core/, data/
docs/              product specs (by stage), architecture, ADRs, roadmap
docs/brief.th.md   owner's product brief (Thai)
supabase/          migrations (Supabase CLI)
AGENTS.md          rules for AI coding agents (CLAUDE.md imports it)
```

## Develop
Needs Node 24 and pnpm 12 (`corepack enable pnpm`).
```
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test
```

## Start here
- Product & specs → [docs/README.md](docs/README.md)
- What to build next → [docs/roadmap.md](docs/roadmap.md)
- Open items → [docs/open-questions.md](docs/open-questions.md)

## Stack
Next.js · Tailwind CSS · shadcn/ui · next-intl · Supabase · Vercel · TMDB · PostHog
