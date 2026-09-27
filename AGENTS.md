# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repo.

## Project
**Mystonie** ("my stone", from *Milestone*; mascot: Stonie, [ADR 0011](docs/decisions/0011-name-mystonie.md)) is *Strava for the shows and movies you finish*. Users log what they watch (episode by episode) and get beautiful, shareable artwork with their stats. Global product: **English-first**, Thai as an optional locale. Folder `mystonie`, GitHub `inatbalthazar/mystonie`, deploy on Vercel `inatbalthazars-projects` (project `mystonie`). Built by a **solo founder**: keep things simple, small and cheap.

**Status:** Stages 0 (card maker) and 1 (collection MVP) are built; only owner tasks (go-live keys, real-device checks, Git link) remain there, and agents move on to Stage 2. The owner wants a polished, complete product before launch: build stages 0 → 1 → 2 back to back without waiting for users, then launch ([ADR 0016](docs/decisions/0016-polish-before-launch.md)). The next task is the first unchecked agent task in [docs/roadmap.md](docs/roadmap.md).

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
| `src/lib/` | Small app helpers (`utils.ts` → `cn`, `site.ts` → site URL, `supabase-browser.ts` → browser client for the sign-in page). Not for domain logic, which goes in `src/core` |
| `src/cards/` | Card templates (`templates/*`, each = component + metadata) and the PNG renderer |
| `src/core/` | Pure TS: types, zod schemas, catalog normalizers, stats, formatting, import parsers (+ `*.test.ts`) |
| `src/data/` | Server-side data access, no React: Supabase clients, typed queries (`database.types.ts` from `pnpm db:types`), external API clients (`tmdb.ts`) |
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
Needs Node 24 and pnpm 12 (`corepack enable pnpm`). When a new dependency has a build script, set it to `true` or `false` under `allowBuilds` in `pnpm-workspace.yaml` (pnpm skips it with a warning until you do).

First-time setup:
```
pnpm install
cp .env.example .env.local         # then fill it in (below)
pnpm db:start                      # prints the local API URL and service_role key
pnpm dev                           # http://localhost:3000
```
`.env.local` for development: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` from `pnpm db:start`, `SEND_EMAIL_HOOK_SECRET` (the local value under `[auth.hook.send_email]` in `supabase/config.toml`), `TMDB_API_TOKEN` (the owner's "API Read Access Token"), `IP_HASH_SALT` (any string). Everything else can stay empty: PostHog, Sentry and email sending are off without keys (`/api/unsubscribe` answers 503 without `UNSUBSCRIBE_SECRET`), and without Supabase the rate limits and title cache switch off (the waitlist and `/api/health` answer 503).

Daily:
```
pnpm lint                          # ESLint (incl. the src/core purity rule and react/jsx-no-literals)
pnpm typecheck                     # next typegen + tsc --noEmit
pnpm test                          # Vitest, all *.test.ts
pnpm test src/core/cards           # single file or folder
pnpm test:watch
pnpm test:e2e                      # Playwright (e2e/): cards, editor, waitlist, auth, collection, series, share, recap, stats, profile, home. Reuses a running pnpm dev on :3000
                                   # or starts one; needs the TMDB token and installed Chrome
pnpm build                         # production build (then pnpm start to serve it)
pnpm dlx shadcn@latest add <name>  # add a shadcn/ui component
```
- `pnpm typecheck` failing inside `.next/dev/types` after moving or deleting routes: delete `.next` (stale dev-server types).
- `CI=1 pnpm test:e2e` uses Playwright's bundled Chromium instead of Chrome (`pnpm exec playwright install chromium` first). `E2E_BASE_URL=http://localhost:3100` points the tests at another server.
- Analytics in development: `track()` records events on `window.__mystonieEvents` (PostHog itself drops headless browsers). `/card-lab` renders every card template × size × hard case (development only).
- Performance check (spec target: Lighthouse mobile ≥ 90): `pnpm build && PORT=3100 pnpm start`, then `npx lighthouse http://localhost:3100/ --only-categories=performance --form-factor=mobile`.

Database (local Supabase, needs Docker Desktop running; the CLI is a devDependency):
```
pnpm db:start                      # start local Postgres/Auth/Studio (prints URLs + keys for .env.local)
pnpm db:reset                      # rebuild the local DB from supabase/migrations
pnpm db:test                       # pgTAP tests in supabase/tests/database
pnpm db:new <name>                 # new migration file
pnpm db:types                      # regenerate src/data/database.types.ts after a migration
pnpm db:stop
```
On Windows, `docker` isn't on PATH by default; for `docker exec supabase_db_mystonie psql -U postgres` add `C:\Users\<you>\AppData\Local\Programs\DockerDesktop\resources\bin`.

Never apply migrations to the remote project unless the owner asks. Remote: Supabase project `mystonie` (ref `fuhwuwhiquysbfjmgtfi`, us-east-1); migrations so far went through the Supabase MCP (`apply_migration`), so its history uses MCP version numbers (see [data model](docs/architecture/data-model.md)). Run `get_advisors` (security) after every remote DDL change.

Deploy: Vercel project `mystonie` (team `inatbalthazars-projects`, functions in `iad1`). Until the owner links the GitHub repo, production deploys are created from GitHub `main` with the Vercel MCP (`create_deployment`, `gitSource` org `inatbalthazar`, repo `mystonie`, ref `main`, target `production`), so **commit and push first**. Env vars live in Vercel; secrets are added by the owner as Sensitive. After a deploy, smoke-test `/`, `/th`, `/api/health`, `/api/trending`, `/api/search?q=strang`.

Launch email (owner-run, [ADR 0019](docs/decisions/0019-email-resend.md)): `curl -X POST https://<domain>/api/admin/launch-email -H "Authorization: Bearer $ADMIN_SECRET" -d '{"dryRun":true}'` previews; without `dryRun` it sends the next ≤ 100 and returns `remaining`. Locally, sign-in emails land in Mailpit (http://127.0.0.1:54324), never in real inboxes: Supabase calls our Send Email Hook at `host.docker.internal:3000`, so email sign-in needs `pnpm dev` on port 3000 ([ADR 0020](docs/decisions/0020-auth-passwordless-ssr.md)); `e2e/auth.spec.ts`, `e2e/collection.spec.ts`, `e2e/series.spec.ts`, `e2e/share.spec.ts`, `e2e/recap.spec.ts`, `e2e/stats.spec.ts`, `e2e/profile.spec.ts` and `e2e/home.spec.ts` read the codes from Mailpit (helpers in `e2e/helpers.ts`) and skip when it isn't running; the collection, series, share, recap, stats, profile and home tests seed their titles (and episodes) through the local service role and mock `/api/search`, so they don't need TMDB. Repeated requests from one machine can trip Vercel's bot challenge (403 "Security Checkpoint"); check in a browser instead of retrying.

Weekly recaps ([ADR 0025](docs/decisions/0025-weekly-recaps.md)): pg_cron calls `POST /api/cron/weekly-recaps` hourly (bearer `CRON_SECRET`; the URL and secret come from Supabase Vault, so the local job stays idle). Locally, start `pnpm dev` with `CRON_SECRET` and `UNSUBSCRIBE_SECRET` set and call it yourself, e.g. `curl -X POST localhost:3000/api/cron/weekly-recaps -H "Authorization: Bearer $CRON_SECRET" -d '{"now":"2026-10-05T03:00:00Z"}'` (`now` is honoured outside production only); recap emails go to Mailpit. `e2e/recap.spec.ts` skips without those two variables.

Web push ([ADR 0028](docs/decisions/0028-home-pwa-web-push.md)): `pnpm push:keys` prints a VAPID pair for `.env.local` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`); without it there is no notifications switch and nothing is pushed. The switch only appears in the installed app (standalone), so headless tests can't use it: `e2e/home.spec.ts` and `e2e/recap.spec.ts` register subscriptions through `POST /api/push` against a local fake push service (`fakePushService` in `e2e/helpers.ts`, allowed outside production) and decrypt what the cron route pushed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
