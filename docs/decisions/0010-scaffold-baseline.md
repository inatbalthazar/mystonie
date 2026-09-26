# ADR 0010: Scaffold baseline (Next.js 16, shadcn/ui on Base UI, Vitest)

**Status:** Accepted · **Date:** 2026-09-23

## Context
The Stage 0 scaffold task had to pick concrete versions and a few defaults that every later task inherits.

## Decision
- **Next.js 16** (App Router, Turbopack, TypeScript strict, `src/`, alias `@/*`) from `create-next-app@latest`, scaffolded in a temp dir and merged into the repo root.
- **pnpm 12** pinned via `packageManager` (enable it with `corepack enable pnpm`). `pnpm-workspace.yaml` only holds pnpm settings (allowed build scripts, release-age exclusions). It is **not** a monorepo.
- **shadcn/ui with the default `base-nova` preset**, which builds on **Base UI** (`@base-ui/react`) instead of Radix, with `neutral` base colour, CSS variables and `lucide` icons. Class merging uses the `cn` package through `src/lib/utils.ts`. The neutral tokens are placeholders until the designer's tokens arrive ([design direction](../design/design-direction.md)).
- **Vitest** in a Node environment for unit tests (`*.test.ts` next to the code). Component or browser tests are added when a task needs them.
- `pnpm typecheck` runs `next typegen` before `tsc`, because the global route types (`LayoutProps`, `PageProps`) live in generated `.next/types`.
- The `src/core` purity rule is an ESLint config block (`no-restricted-imports` + `no-restricted-globals`), guarded by `eslint.config.test.ts`.
- `AGENTS.md` keeps the `nextjs-agent-rules` block that `next dev` writes, so running the dev server doesn't dirty the tree.

## Consequences
- Follow the shadcn docs for Base UI when adding components (`pnpm dlx shadcn@latest add <name>`). Radix-only snippets need adapting.
- Next.js 16 APIs may differ from older examples. Read `node_modules/next/dist/docs/` before using an unfamiliar API.
