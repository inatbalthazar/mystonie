# ADR 0006: One Next.js app + Supabase (solo-founder stack)

**Status:** Accepted · **Date:** 2026-09-23 · **Supersedes:** [0002](0002-monorepo-with-shared-core.md)

## Context
The owner is a solo founder who wants a usable app first and expansion only after users grow. The earlier pnpm monorepo with separate packages and many services (API layer, search engine, job runner, sync engine) is too much surface for one person to build and maintain.

## Decision
- A **single Next.js app** (App Router, TypeScript strict) at the repo root, with **Supabase** (Postgres + RLS, Auth, Storage, pg_cron) as the backend.
- Server logic lives in Next.js route handlers / server actions. No separate API service and no Edge Functions until needed.
- Portability without packages: `src/core` is pure TypeScript (no React/Next/DOM/Supabase imports, enforced by lint), and `src/data` holds Supabase access without React. These folders can be extracted into packages when an Expo app is built.
- Deferred until a gate needs them: Hono API layer, Drizzle, Meilisearch, Trigger.dev, PowerSync, Expo, RevenueCat.

## Consequences
- Fewer accounts, bills and failure points. Agents only need one mental model.
- The mobile app will require a one-time extraction of `src/core` / `src/data` into packages. That cost is accepted.
