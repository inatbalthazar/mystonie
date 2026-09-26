# ADR 0002: pnpm monorepo with platform-agnostic shared packages

**Status:** Superseded by [0006](0006-single-nextjs-app.md) · **Date:** 2026-09-23

## Context
Phase 1 is a Next.js PWA. Phase 2 is a React Native (Expo) app that must reuse the stats logic and Supabase data access. If that code lives inside Next.js pages/components, it will have to be rewritten.

## Decision
A **pnpm workspace** monorepo:
- `apps/web`: Next.js (App Router) + Tailwind + shadcn/ui.
- `packages/core` (`@mysto/core`): pure TypeScript domain logic. No React, Next, DOM or Supabase imports.
- `packages/data` (`@mysto/data`): Supabase client, repositories, offline sync. Platform APIs (IndexedDB vs SQLite) go behind interfaces.
- `supabase/`: migrations, seeds, Edge Functions (Deno).
- Later: `apps/mobile` (Expo) consuming the same packages.

Turborepo may be added for task caching when builds get slow. It's not needed at the start.

## Consequences
- Clear placement rules for agents (see [AGENTS.md](../../AGENTS.md)).
- Slight setup overhead (workspace TS config, package builds or TS path transpilation in Next via `transpilePackages`).
