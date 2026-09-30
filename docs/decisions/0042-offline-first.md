# ADR 0042: Offline-first with a service worker that keeps the pages people open and an outbox that replays the app's own writes; the later change wins by device time

**Status:** Accepted · **Date:** 2026-09-30 · Supersedes [ADR 0004](0004-offline-first-sync.md); replaces the service worker part of [ADR 0028](0028-home-pwa-web-push.md)

## Context
The sixth stage 3 task ([S3 offline](../product/features/S3-offline.md)) asks the installed app to open, show the collection and log with no connection, then sync. Two offline devices editing one entry must end with the later edit and no duplicates.

The old design ([ADR 0004](0004-offline-first-sync.md), [later: offline-first](../product/later/offline-first.md)) planned:
- a local store in IndexedDB mirroring the user's tables, which the UI reads instead of Supabase;
- an outbox of row upserts, and pulls by `updated_at` cursor;
- last-write-wins by the order changes reach the server;
- a look at PowerSync, ElectricSQL or RxDB first.

What the app is now:
- Pages are server components that read Supabase directly.
- Writes go through route handlers ([ADR 0022](0022-collection-writes-through-route-handlers.md)) that do more than save a row. They cache the title from its catalog, move a wanted title to watching when an episode is logged, and then milestones, badges, challenges and finisher numbers follow.
- Clients can't upsert most columns (column grants, [ADR 0021](0021-collection-tables-rules-in-the-database.md)).
- The service worker ([ADR 0028](0028-home-pwa-web-push.md)) only handled push, and was registered only when notifications were turned on.

Constraints: one Next.js app + Supabase, no new services or packages ([ADR 0006](0006-single-nextjs-app.md)), free to run.

## Decision
**Reading offline: the service worker keeps the pages people open.** There is no local copy of the database.
- `public/sw.js` (plain JavaScript) is registered for every visitor by `SyncProvider` in the layout.
- **Pages** are network first, with navigation preload.
  - When the network fails, or takes over 8 s and a copy exists, the saved copy answers.
  - With no copy, the saved `/offline` page answers, and the URL stays.
  - Only pages without a query are kept (`?source=pwa` aside), never `/api`, `/auth`, `/unsubscribe` or `/card-lab`. At most 40.
- **Their files:** saving a page also fetches everything its HTML names:
  - scripts and styles (`/_next/static/…`, and `static/chunks/…` in the React data);
  - every font those styles name (about 400 KB, once);
  - the site's own images (logo, TMDB logo).

  So a page saved in the background also hydrates offline. `/_next/static` files and same-origin images are network first, with the copy used offline.
- **Posters** (TMDB, AniList, our book covers) are cache first, fetched with CORS (at most 400). The worker's own fetches follow its Content-Security-Policy, which now allows those two hosts.
- **Which pages are saved:**
  - Home and the collection: on the first page load when the copy is missing or a day old, and fresh after changes go through;
  - the page the user is on, after a change goes through.

  So the installed app opens on Home offline (`start_url` is `/home?source=pwa`).
- **Rejected:**
  - *A local store mirroring the tables (ADR 0004).* Every page would need a second, client-side way to read its data, and the server-side effects above would have to be copied into the browser. That is too much for one person; the saved pages give "readable offline" for the pages people use.
  - *PowerSync, ElectricSQL, RxDB.* Each is a new service or package, paid tiers or self-hosting. They sync rows, not our routes' effects.
  - *Serwist / Workbox.* A package and a build step for about 250 lines of worker.
  - *Precaching a build manifest.* The App Router has no stable per-page chunk list; saving what each page names is exact.
  - *Next's `experimental.useOffline`.* In Next 16 it makes link navigations wait for the connection. Without it, a failed navigation falls back to a full page load, which the worker answers from the saved copy.

**Writing offline: an outbox replays the app's own route calls.**
- Every collection change goes through `send(userId, op)` (`src/components/offline/outbox.ts`):
  - it is kept in IndexedDB (`mystonie` → `outbox`);
  - it is laid over the server's data at once (pure overlays in `src/core/sync/overlay.ts`, marked sending or waiting);
  - it is sent in order to the same routes as before (`opRequest` in `src/core/sync/ops.ts`).
- **Ops:** entry add, status, notes and remove; episodes log and unlog; reading log and unlog.
  - Ids are client UUID v7 (as before), so a later op can point at an entry or log that hasn't synced.
  - When the server keeps its own row (the title or episode was already there), queued ops pointing at ours are rewritten to it (`keptIds`).
- **Outcomes** (`opOutcome`):
  - 2xx is done. 404 is also done for edits and removals (the row is gone).
  - 401: held until the user signs in.
  - 409 `other_account`: held. Each request carries `X-Mystonie-User`, so a change made in one account never lands in another that signs in on the device.
  - 408, 429 and 5xx are retried: 2 s doubling up to 5 min, honouring `Retry-After`. After 6 tries it becomes "couldn't be saved", with Try again and Discard.
  - Any other 4xx fails at once.
- **When ops are sent:**
  - right away when online;
  - on `online`;
  - when the app comes back to the front after more than 5 s;
  - on focus, at most once a minute;
  - while offline, when a probe gets through: a `HEAD /manifest.webmanifest` (never answered by the worker) every 2 s, doubling to 30 s.

  After ops go through, `router.refresh()` brings the server's data, which also brings other devices' changes. Settled ops stay laid over the page until a refresh that started after them lands, so rows never flicker back.
- **Signing out** with changes waiting asks first, then clears the outbox, saved pages, posters and recent titles. When another account opens a page with its data on the device, pages and recent titles are cleared too.
- **Rejected:** the Background Sync API. It is Chromium only, and the app already sends whenever it is open.

**Conflicts: the later change wins, by when it was made on the device.**
- `entries.edited_at` holds the device time of the entry's last change.
  - The clock is clamped to the server's now, so a fast clock can't lock an entry into the future.
  - A trigger stamps now() on changes that don't send one: imports, the service role, older clients.
- A change applies only when `edited_at` isn't newer than it. Otherwise the route answers `superseded` with the entry as it is, and the page says "“X” was changed on another device after this, so that change stays."
- **Adding a title already in the collection** changes that entry (one live entry per title, as before). So two devices adding the same title offline make one entry.
- **A removal that reached the server is final.** Later edits of that entry find nothing (404, done). Adding the title again makes a new entry.
- **Logs are append-only facts** with their device time (`watchedAt`, `readAt`, clamped to now). A log made offline lands on the day it happened in stats, recaps and challenges.
  - The same episode logged on two devices is one log (the unique index).
  - A log's automatic want → watching respects `edited_at`.
- **Rejected:**
  - *Server arrival order (ADR 0004).* A change that waited offline would overwrite a later one made elsewhere, which is not "the later edit".
  - *Field-level merging or CRDTs.* An entry is one small decision (status, date, rating); merging fields could produce a state nobody chose.

**Search offline:** the catalogs need the network, so quick add says so. It offers titles seen lately on this device instead: picked in search, opened on a title page, or shown in Home's trending. That is the newest 24, kept in `localStorage`.

**Online-only:** sharing cards, Stamps, follows, joining clubs and challenges, imports, settings and Pro. The server checks them, or they involve other people. A finish still opens its celebration offline, and Share waits ("Share once you're online").

## Consequences
- **Migration:** `20261006090000_stage3_offline_sync.sql` adds `entries.edited_at`, the `entries_stamp_edited_at` trigger and the column grants. Local only so far; the remote project gets it with the rest of stage 3.
- **`next.config.ts`:**
  - The worker's CSP gains `connect-src` for `image.tmdb.org` and `s4.anilist.co`. Without it, a worker-controlled page couldn't load posters at all.
  - `experimental.reactDebugChannel: false` applies to development only. React's debug info then comes inside the page, as in production builds, instead of over a WebSocket that a page opened offline never gets (such a page wouldn't hydrate).
- **Playwright:** the config blocks service workers (`serviceWorkers: "block"`) in every spec but `e2e/offline.spec.ts`, so no other test gets a saved page.
- **Stale copies:** a saved page is the server's HTML at save time, with waiting changes laid over the collection, series and reading lists. Stats and Home's numbers show the last save until the device is back online.
- **Storage:** at most 40 pages, 1,000 app files and 400 posters. The installed app asks for persistent storage (`navigator.storage.persist`). iOS still evicts a site's storage after weeks without use, which is one more reason for the real-device check (an owner task).
- **Installability:** Lighthouse 12 dropped its PWA category, so installability is checked with Chrome's own check (DevTools → Application → Manifest, or CDP `Page.getInstallabilityErrors`). The production build has no errors.
