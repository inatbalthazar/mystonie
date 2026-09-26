# F09 · Offline-first & PWA

> **Status: LATER (gated).** Not part of the current plan. See [later/README.md](README.md) for the gate. Written before the global, solo-sized plan: re-check against AGENTS.md before building.

**Phase:** M3 (IDs and `updated_at` columns are needed from M1) · **Priority:** Must-have for the mobile experience

## Summary
People log things on planes, on the train, or while playing a handheld console. The app must open and accept writes with no connection, store them locally, and sync to Supabase when back online. The web app is an installable **PWA** ("Add to Home Screen", full-screen, app icon).

## User-facing behaviour
- The app shell loads offline (service worker precache).
- Collections, stats and cached title metadata are readable offline.
- Adding, editing or deleting entries offline works instantly, and a small "pending sync" indicator shows the queued count.
- Search needs the network. When offline, show "You're offline: search will work when you reconnect" and allow adding from recently viewed/cached titles.
- Economy actions (wheel, quiz, wallet, store) are **online-only** and say so clearly.

## Rules
Mechanics are in [architecture/offline-sync.md](../../architecture/offline-sync.md). Summary:
- Client-generated UUID v7 IDs, `updated_at` on every synced row, soft deletes.
- Local store (IndexedDB) + outbox queue. Sync code lives in `packages/data`, UI-agnostic, so it can be reused by Expo.
- Conflict policy: last-write-wins per row on `updated_at` (server clock stamps on receipt).

## Acceptance criteria
- [ ] With the network disabled in DevTools, the installed PWA opens, shows the collection and adds an entry.
- [ ] After reconnecting, the entry appears on a second device within 10 s of the app being foregrounded.
- [ ] Editing the same entry on two offline devices resolves to the later edit, with no duplicates.
- [ ] Lighthouse PWA installability passes.
