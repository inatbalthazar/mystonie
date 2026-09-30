# ADR 0004: Offline-first with a local store + outbox, last-write-wins

**Status:** Superseded by [ADR 0042](0042-offline-first.md) (built in stage 3 without a local copy of the database; the later change wins by device time, not by arrival). The data rules (UUID v7, server `updated_at`, soft delete) still apply · **Date:** 2026-09-23

## Context
Users log entries without connectivity (planes, handheld gaming). The app must accept writes offline and sync later, on web now and on Expo later.

## Decision
- Client-generated **UUID v7** IDs. `updated_at` is server-stamped by trigger. **Soft deletes** via `deleted_at`.
- UI reads/writes a **local store** (IndexedDB on web) through `packages/data`. Mutations are appended to an **outbox** and pushed via upsert. Pulls use `updated_at > cursor`.
- **Last-write-wins** per row. Duplicate (user, title) entries created on two devices are merged by the server upsert.
- The economy and other server-validated actions are online-only.
- Details: [architecture/offline-sync.md](../architecture/offline-sync.md).

## Alternatives considered
Off-the-shelf sync engines (PowerSync, ElectricSQL, RxDB replication). These are worth re-evaluating in M3 if the hand-rolled outbox gets complex. The data model (UUIDs, `updated_at`, soft deletes) is compatible with them.

## Consequences
Every synced table needs the sync columns and trigger from the first migration (M1), even though offline UI arrives in M3.
