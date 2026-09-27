# Mystonie

> **Strava for the shows and movies you finish.**

Log every movie, series and episode you watch, and get beautiful, shareable artwork with your stats, ready for Stories. Your cards become your collection. Later, Mystonie also warns you about scenes you'd rather avoid.

*Finished it? Mystonie it.*

**Status:** **Stage 0: Mystonie Card** is built (next: Stage 1, the collection), a card maker with no login: search a title, pick a template, add a rating and review, then share or download the PNG. Live at https://mystonie.vercel.app.

## Repo map
```
src/app/           pages ([locale]/) and route handlers (api/)
src/cards/         card templates, preview and PNG export (browser)
src/core/          pure TypeScript domain logic + unit tests
src/data/          server-side data access (Supabase, TMDB)
src/components/    shared UI · src/lib/ small app helpers · src/i18n/ next-intl setup
messages/          UI strings (en.json first, th.json)
e2e/               Playwright tests
docs/              product specs (by stage), architecture, ADRs, roadmap
docs/brief.th.md   owner's product brief (Thai)
supabase/          migrations + pgTAP tests (Supabase CLI)
AGENTS.md          rules for AI coding agents (CLAUDE.md imports it)
```

## Develop
Needs Node 24 and pnpm 12 (`corepack enable pnpm`).
```
pnpm install
cp .env.example .env.local   # fill in: see AGENTS.md "Commands"
pnpm db:start                # local Supabase (Docker Desktop)
pnpm dev                     # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm db:test
```
All commands (e2e, database, deploy): [AGENTS.md](AGENTS.md#commands).

## Start here
- Product & specs → [docs/README.md](docs/README.md)
- What to build next → [docs/roadmap.md](docs/roadmap.md)
- Open items → [docs/open-questions.md](docs/open-questions.md)

## Stack
Next.js · Tailwind CSS · shadcn/ui · next-intl · Supabase · Vercel · TMDB · PostHog · Sentry · Vitest · Playwright
