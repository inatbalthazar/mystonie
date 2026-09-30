# Offline-first sync

Built in stage 3: [S3 offline](../product/features/S3-offline.md) (behaviour), [ADR 0042](../decisions/0042-offline-first.md) (why). It replaces the deferred design of [ADR 0004](../decisions/0004-offline-first-sync.md): there is no local copy of the database. A service worker keeps the pages people open, and an outbox replays the app's own route calls.

## Pieces
| Where | What |
|---|---|
| `public/sw.js` | The service worker: saved pages, the app's files, posters; push ([ADR 0028](../decisions/0028-home-pwa-web-push.md)) |
| `src/components/offline/sync-provider.tsx` | Mounted once in the layout. Registers the worker, starts the outbox, sends on `online` / back in front / focus / `pageshow`, refreshes the page's data after sends, asks the worker to save pages |
| `src/components/offline/outbox.ts` | The outbox: `send`, `flush`, online probing, outcomes, `useOutbox`, `useOverlayOps` |
| `src/components/offline/idb.ts` | IndexedDB database `mystonie`, store `outbox` |
| `src/core/sync/ops.ts` | Pure: the op types, `opRequest` (op → route call), `opOutcome`, `retryDelay`, `keptIds` / `withKeptIds` |
| `src/core/sync/overlay.ts` | Pure: lays ops over the server's data (collection, watch and reading logs, a series' episodes, a title's entry) |
| `src/components/offline/sync-status.tsx` | The pending-sync note under the header |
| `src/components/offline/recent-titles.ts` | "Seen lately on this device" for offline quick add (`localStorage`, 24) |
| `src/components/offline/offline-data.ts`, `saved-pages.ts` | Clearing the device on sign-out, account deletion or another account |
| `src/app/[locale]/offline/page.tsx` | The offline page (static, kept per locale) |

## The service worker
| Cache | Holds | Limit | Cleared with the user's data |
|---|---|---|---|
| `mystonie-pages-v1` | page HTML by origin + path, with `X-Mystonie-Saved` (when) | 40 (newest kept) | yes |
| `mystonie-shell-v1` | the offline page, per locale | – | no |
| `mystonie-assets-v1` | `/_next/static` files, the site's own images | 1,000 | no (the same for everyone) |
| `mystonie-images-v1` | posters and covers | 400 | yes |

Requests:
- **Navigations (same origin):** network first, with navigation preload.
  - A 200 HTML answer for a page that may be kept is saved, with its files.
  - On a network failure, or after 8 s when a copy exists: the saved copy (matched by path, so `/collection?add=1` gets the collection), else the offline page, else an error.
  - Kept pages: no query (`?source` aside), never `/api`, `/auth`, `/unsubscribe` or `/card-lab`.
- **`/_next/static/*` and same-origin images:** network first; the saved copy offline.
- **Posters** (`image.tmdb.org`, `s4.anilist.co`, `media.rawg.io`, `/api/covers/*`): cache first, fetched with CORS so the size is real and cards can still draw them. The worker's CSP (`next.config.ts`) allows `connect-src` to these hosts.
- **Everything else** (the API, React Server Component fetches, analytics) isn't touched.
- **"save" messages** from the page (at most 5 URLs): fetched with the session and saved.

Saving a page also saves the files it needs:
- every `/_next/static/…` path in its HTML, and `static/chunks/…` in the React data;
- every same-origin image `src` or `href`;
- the fonts named in its style sheets.

So a page saved in the background hydrates offline. A new worker version deletes old `mystonie-*` caches when it activates. The worker is served with `no-cache`, so a fix reaches installed apps on their next visit.

## The outbox
An item: `{ id (UUID v7), userId, at, op, attempts, state: queued | failed | held, notBefore?, reason? }`. Items are kept in IndexedDB, and the ids give their order.

| Op | Request |
|---|---|
| `entry.add` | `POST /api/entries { id, title, status, finishedAt, editedAt }` |
| `entry.status` | `PATCH /api/entries/[id] { status, finishedAt, editedAt }` |
| `entry.notes` | `PATCH /api/entries/[id] { rating, review, editedAt }` |
| `entry.remove` | `PATCH /api/entries/[id] { deleted: true, editedAt }` |
| `episodes.log` | `POST /api/episodes { externalId, episodes, watchedAt }` |
| `episode.unlog` | `PATCH /api/episodes/[id] { deleted: true }` |
| `reading.log` | `POST /api/reading { id, kind, externalId, unit, position, readAt }` |
| `reading.unlog` | `PATCH /api/reading/[id] { deleted: true }` |

Every op carries the title (name, year, poster), so it can be shown before the server has it. Every request carries `X-Mystonie-User`.

**Sending** (`flush`): one op at a time, in order, while online.

| Answer | Outcome |
|---|---|
| 2xx | done (`settle`) |
| 404 | done for edits, removals and unlogs (the row is gone); failed for adds and logs |
| 401 | held until signed in, and the flush stops |
| 409 `other_account` | held (another account's change) |
| 408, 429, 5xx | tried again after `retryDelay` (2 s doubling to 5 min, `Retry-After` first); failed after 6 tries |
| other 4xx | failed |
| network error | offline: the op stays queued |

- **Kept ids:** when the server kept its own entry or log, queued ops that point at ours are rewritten to it (`withKeptIds`).
- **Settled ops** stay laid over the page until a `router.refresh()` that started after them lands (`pruneSettled`).
- **"Synced" note:** ops that had to wait (made or queued offline, held, retried, or left from an earlier visit) count towards "Back online: N changes synced".

**Online or not:**
- `navigator.onLine` and its events;
- a failed send;
- a `HEAD /manifest.webmanifest` probe: every 2 s, doubling to 30 s, while offline; also when back in front, on focus and on `online`.

The worker never answers the probe (it only handles GET).

**Pages that lay ops over their data** (`useOverlayOps(userId)`, which also tells the outbox who is signed in):
- the collection;
- the series page's episodes and entry;
- Home's Up next;
- reading progress.

Each keeps the server's rows as props, adopts new props after a refresh, and renders `overlay…(rows, ops)`.

## Conflicts
- **`entries.edited_at`** is the device time of the entry's last change.
  - The routes send it (`editedAt`, clamped to now by `actionTime` in `src/core/collection/entries.ts`).
  - The `entries_stamp_edited_at` trigger clamps it to now() again, and stamps now() on a change that doesn't send one.
- **An entry write applies only when `edited_at <= editedAt`.** Otherwise `addEntry` / `updateEntry` (`src/data/entries.ts`) return the entry as it is with `superseded: true`, and the page shows it with a note.
- **Adding a title that's already there** is an update of that entry: one live entry per (user, title), as before.
- **A removal** sets `deleted_at` to its device time. Edits of a removed entry get a 404, and count as done.
- **Logs** are inserts with their device time (`watchedAt`, `readAt`). The unique indexes keep one live log per episode or reading point. A log that moves a wanted title to watching (`startWatching`) respects `edited_at`.

## Clearing the device
- **Sign-out** (`sign-out-form.tsx`): warns when changes are waiting, then clears the outbox, the `mystonie-pages-*` and `mystonie-images-*` caches and recent titles before posting.
- **Account deletion:** clears the same.
- **Another account:** when a page with another account's data opens (`localStorage` `mystonie.user` changes), pages and recent titles are cleared. That account's waiting changes are held, with Discard.

## Development and tests
- `next.config.ts` turns off React's debug channel in development (`experimental.reactDebugChannel: false`). Otherwise a page opened offline waits for a WebSocket and never hydrates.
- Playwright blocks service workers in every spec (`serviceWorkers: "block"` in `playwright.config.ts`) except `e2e/offline.spec.ts`. `context.setOffline(true)` cuts off the page and its worker, like flight mode.
- **Unit:** `src/core/sync/ops.test.ts`, `overlay.test.ts`, and the device-time cases in `entries.test.ts`, `episodes.test.ts`, `reading.test.ts`.
- **pgTAP:** `supabase/tests/database/stage3_offline_sync.test.sql`.
- **e2e:** `e2e/offline.spec.ts`: opening offline, adding from "Seen lately", reload, sync to a second device within 10 s of coming to the front, and two offline devices with the later edits synced first.
- **By hand:** DevTools → Application → Service workers / Cache storage / IndexedDB, and Network → Offline.
