# ADR 0022: Collection writes go through route handlers, with optimistic UI

**Status:** Accepted · **Date:** 2026-09-27

## Context
Quick add ([S1 collection](../product/features/S1-collections.md)) must take ≤ 3 taps and show the new entry at once. Adding a title needs two writes:
1. the TMDB title must be in `titles`, which only the server may write ([ADR 0012](0012-catalog-api-caching-and-limits.md));
2. the entry itself.

RLS ([ADR 0021](0021-collection-tables-rules-in-the-database.md)) would let the browser write entries directly with supabase-js. [ADR 0020](0020-auth-passwordless-ssr.md), however, keeps supabase-js out of every bundle except the sign-in page.

## Decision
- **Writes go through our route handlers:**
  - `POST /api/entries` caches the title (from the cache or TMDB) and saves the entry.
  - `PATCH /api/entries/[id]` changes the status or finish date, or soft-deletes.
  - Both run as the signed-in user with `userClient()`, so RLS still applies.
  - A quick add is therefore one request, and supabase-js stays out of the browser. Rejected, direct writes from the browser: they would need two round trips (cache the title, then insert) and put supabase-js in the app bundle.
- **One live entry per title:** adding a title that's already in the collection updates that entry instead of failing on the unique index. The response carries the entry's real id.
- **Optimistic UI:**
  - The list changes at once, with the client's UUID v7 id and a "Saving…" state.
  - The server's answer replaces the row; a failure rolls it back and shows a notice.
  - Validation is shared: `src/core/collection/entries.ts` runs in the browser and, authoritatively, in the routes.
- **The finish date is picked as a local date** in the profile's time zone:
  - today means now;
  - an earlier day means noon that day, which stays inside the day across DST;
  - an unchanged day keeps the stored time.
- **Sheets use the native `<dialog>`** (`src/components/sheet.tsx`), which provides the focus trap, Esc and an inert background. Rejected: adding a dialog component to the design system for two sheets.

## Consequences
- Offline sync (later) will need its own outbox or upsert path. These routes are online-only, like the rest of stage 1.
- New write flows (episode logs, cards) follow the same pattern: a route handler, `userClient()`, and validation in `src/core`.
- Navigating away while a write is still pending can lose it, as on any web form. The e2e waits for the answer before reloading.
