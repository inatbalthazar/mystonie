# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repo.

## Project
**Mystonie** ("my stone", from *Milestone*; mascot: Stonie, [ADR 0011](docs/decisions/0011-name-mystonie.md)) is *Strava for the shows and movies you finish*. Users log what they watch (episode by episode) and get beautiful, shareable artwork with their stats. Global product: **English-first**, Thai as an optional locale. Folder `mystonie`, GitHub `inatbalthazar/mystonie`, deploy on Vercel `inatbalthazars-projects` (project `mystonie`). Built by a **solo founder**: keep things simple, small and cheap.

**Status:** Stage 0 in progress. The Next.js app is scaffolded at the repo root. The next task is the first unchecked item of **Stage 0** in [docs/roadmap.md](docs/roadmap.md).

## Workflow
1. Read [docs/product/vision.md](docs/product/vision.md), then take the first unchecked, non-🧑 task of the current stage in [docs/roadmap.md](docs/roadmap.md) (or the task you were given).
2. Read **only** the spec it links to plus the architecture doc it touches ([docs/README.md](docs/README.md) is the index).
3. Implement the smallest change that meets the spec's **acceptance criteria**. Add tests for anything in `src/core`.
4. Run lint, typecheck and tests (see Commands).
5. In the same change, tick the roadmap box, update the spec or data model if behaviour or schema changed, and add an ADR if you chose between alternatives.
6. Spec silent or ambiguous? Check [docs/open-questions.md](docs/open-questions.md), use its default and say so, or ask. **Never build features from [docs/product/later/](docs/product/later/README.md)** unless the owner explicitly says so.

## Hard rules
- **English-first i18n:** every UI string goes through next-intl (`messages/en.json` first, `th.json` optional). No hard-coded copy, no country-specific core features, and nothing that signals a home country ([ADR 0007](docs/decisions/0007-english-first-global.md)).
- **Time:** store `timestamptz` UTC, display in `profiles.time_zone`, format with `Intl` and the user's locale.
- **Single app:** one Next.js app + Supabase. Don't add new services, packages or runtimes without an ADR ([ADR 0006](docs/decisions/0006-single-nextjs-app.md)).
- **`src/core` is pure TypeScript:** no React, Next, DOM or Supabase imports. It must stay extractable for a future Expo app.
- **External APIs are called only from route handlers** (keys never reach the browser), normalized in `src/core/catalog`, cached in Postgres and attributed as required (TMDB, JustWatch, DTDD). Movie/TV data comes from TMDB ([ADR 0001](docs/decisions/0001-tmdb-instead-of-imdb.md)). Warnings come from DoesTheDogDie first ([ADR 0009](docs/decisions/0009-content-warnings-from-dtdd-first.md)).
- **Cards render in the browser** (component → PNG) with Noto fallbacks for Thai/Korean/Japanese ([ADR 0008](docs/decisions/0008-client-side-card-rendering.md)).
- **Data day-one rules:** RLS on every table. User rows use client-generated UUID v7, server-stamped `updated_at` and soft delete via `deleted_at`.
- **Money is server-authoritative:** Pro entitlements only from verified Stripe webhooks, and any future rewards or currency are computed on the server ([ADR 0003](docs/decisions/0003-server-authoritative-economy.md)).
- **UX budget:** logging ≤ 3 taps. Celebrate first (card), optional questions after. Mobile-first at 360px, dark mode checked.
- Never commit secrets. Add new env var *names* to `.env.example`.

## Where code goes
| Path | Put here |
|---|---|
| `src/app/[locale]/` | Pages and layouts |
| `src/app/api/` | Route handlers: search proxy, warnings, recaps, Stripe webhook |
| `src/components/` | Shared UI (shadcn/ui primitives in `ui/`) |
| `src/i18n/` | next-intl setup: `routing.ts` (locales), `navigation.ts` (locale-aware `Link`, `useRouter`), `request.ts` (messages + English fallback) |
| `src/lib/` | Small app helpers (`utils.ts` → `cn`, `site.ts` → site URL). Not for domain logic, which goes in `src/core` |
| `src/cards/` | Card templates (`templates/*`, each = component + metadata) and the PNG renderer |
| `src/core/` | Pure TS: types, zod schemas, catalog normalizers, stats, formatting, import parsers (+ `*.test.ts`) |
| `src/data/` | Supabase clients and typed queries (no React) |
| `messages/` | next-intl messages (`en.json`, `th.json`) |
| `supabase/migrations/` | SQL schema, RLS, triggers, seeds |

## Stack
Next.js 16 (App Router, Turbopack, TypeScript strict) · Tailwind CSS 4 · shadcn/ui (Base UI, [ADR 0010](docs/decisions/0010-scaffold-baseline.md)) · Motion · next-intl · Supabase (Postgres, Auth, Storage, pg_cron) · Recharts · modern-screenshot (card export) · PostHog (cookieless) · Sentry · Stripe (stage 2) · Vitest · Playwright · pnpm · Vercel.

## CI
GitHub Actions (`.github/workflows/ci.yml`) runs `lint`, `typecheck`, `test` and the pgTAP DB tests on every push to `main` and every PR. Keep it green; run the same commands locally before pushing.

## Conventions
- DB `snake_case`, TS `camelCase`. Map between them in `src/data`.
- Tests next to code (`*.test.ts`). RLS policies get SQL tests.
- Conventional commits (`feat(cards): …`) that mention the roadmap task.

## Commands
Needs Node 24 and pnpm 12 (`corepack enable pnpm`).
```
pnpm install
pnpm dev                           # http://localhost:3000
pnpm lint                          # ESLint (incl. the src/core purity rule)
pnpm typecheck                     # next typegen + tsc --noEmit
pnpm test                          # Vitest, all *.test.ts
pnpm test src/core/stats           # single file or folder
pnpm build                         # production build
pnpm dlx shadcn@latest add <name>  # add a shadcn/ui component
```
If `pnpm typecheck` fails inside `.next/dev/types` after moving or deleting routes, delete `.next` (stale dev-server types).

Database (local Supabase, needs Docker Desktop running; the CLI is a devDependency):
```
pnpm db:start                      # start local Postgres/Auth/Studio (prints URLs + keys for .env.local)
pnpm db:reset                      # rebuild the local DB from supabase/migrations
pnpm db:test                       # pgTAP tests in supabase/tests/database
pnpm db:new <name>                 # new migration file
pnpm db:stop
```
Never apply migrations to the remote project unless the owner asks.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
