# Offline-first sync

> **Status: LATER.** Stages 0–2 ship as a PWA with optimistic UI only. **What applies now** are the day-one data rules this design depends on: client UUID v7, server `updated_at`, soft delete. Full offline sync is gated (see [later/offline-first.md](../product/later/offline-first.md)). When it's built, evaluate PowerSync before hand-rolling the outbox below, and use `src/data` instead of the `packages/data` path mentioned here.

Implements the mechanics behind [later/offline-first.md](../product/later/offline-first.md). Decision record: [ADR 0004](../decisions/0004-offline-first-sync.md).

## Scope
Synced offline: `entries`, `collection_settings`, `user_avoid_tags`, `warning_votes`, profile edits.
**Online-only** (never queued): anything in the economy (wallet, wheel, quiz, store, payments), warning *submissions* that need server validation, imports, chat.

## Building blocks (all in `packages/data`)
1. **IDs:** the client generates UUID v7 for new rows (time-ordered, index-friendly). No server round-trip is needed to create.
2. **Local store:** a `LocalStore` interface with an IndexedDB implementation for web (e.g. Dexie) and later SQLite for Expo. UI reads from the local store, not directly from Supabase.
3. **Outbox:** every local mutation appends `{ id, table, op: upsert|delete, row, client_updated_at, attempts }` to an outbox table in the same local transaction.
4. **Push:** when online (and on app focus, on `online` event, and on a periodic timer), flush the outbox in order via `upsert` (soft delete = upsert with `deleted_at`). The server trigger sets `updated_at = now()`.
5. **Pull:** fetch rows with `updated_at > last_pulled_at` per table (paginated) and merge into the local store. Store `last_pulled_at` from the **server** timestamps returned, never the device clock.
6. **Realtime (optional):** subscribe to Supabase Realtime for the user's rows to shorten sync latency. Pull stays the source of truth.

## Conflict policy
- **Last-write-wins per row** based on server `updated_at` order of arrival.
- The unique (`user_id`, `title_id`) on active entries: if two devices add the same title offline, the server upsert uses `on conflict (user_id, title_id) where deleted_at is null` → merge into the existing row (keep the earliest `finished_at` unless the user edited it explicitly), and return the canonical id. The client rewrites its local id.
- Deletes win over older edits (a tombstone with a newer `updated_at`).

## Failure handling
- Retry with exponential backoff. After N failures, mark the item `failed` and surface it in the "pending sync" UI with retry/discard.
- Validation errors (4xx) are not retried. Show them to the user.
- Sign-out with a non-empty outbox warns the user before clearing local data.

## Testing
- Unit tests for merge logic in `packages/data` with a fake Supabase and an in-memory `LocalStore`.
- E2E (Playwright): offline add → reload → online → verify on the server.
