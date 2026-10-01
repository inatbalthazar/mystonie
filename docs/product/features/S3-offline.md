# S3 · Offline-first

**Stage:** 3 · **Built:** [ADR 0042](../../decisions/0042-offline-first.md) · From [later: offline-first](../later/offline-first.md) · Mechanics: [offline sync](../../architecture/offline-sync.md)

## Summary
People log on planes, on the train, and in places with no signal.
- The installed app **opens without a connection**, shows the collection and the pages opened before, and logs as usual.
- What's logged offline is **kept on the device** and syncs by itself once the connection is back. Another device shows it within seconds of coming to the front.
- Two devices changing the same entry end with **the later change**, and never a duplicate.

## Rules
### Opening offline
- **Pages opened are kept on the device** with their scripts, styles, fonts and posters (the service worker, [ADR 0042](../../decisions/0042-offline-first.md)):
  - Home and the collection, on the first visit and once a day, and fresh after changes sync;
  - the page the user is on, after a change on it syncs.

  At most 40 pages; sign-in, unsubscribe links and pages with a query aren't kept.
- **Offline, a kept page opens as it was saved**, with the changes waiting on the device laid over it: collection rows, episodes and reading progress.
  - Title pages opened before open too.
  - Stats and Home's numbers are as of the last save.
- **A page this device hasn't kept** shows the offline page: a note taped into the album with an "Offline" stamp, "This page isn't saved on this device yet", and links to the pages it has (Home, Collection, Stats).
- Online but very slow (no answer in 8 s): the kept copy shows instead of waiting.

### Logging offline
- **Works offline and shows at once:**
  - adding in quick add;
  - changing status or finish date, removing;
  - the rating and review in the celebration;
  - logging and un-logging episodes (series page, Home's Up next);
  - logging and un-logging reading progress.
- **Rows waiting to sync** say "Waiting to sync" (collection rows, reading history). Episodes waiting have a dashed check. Rows being sent say "Saving…", as before.
- **Search needs the network.** Offline, quick add says "You're offline, so search will work when you reconnect. Add something you've seen lately instead." and shows **Seen lately on this device**. These are titles picked in search, title pages opened and Home's trending: the newest 24.
  - With none: "Titles you open or search for show up here, so you can add them offline."
  - The nav island's ➕ still opens quick add on a kept collection page.
- **The celebration opens for a finish**, as online. Its Share button waits: "Share once you're online".

### The pending-sync note
A small taped note under the header (`role="status"`), only when there's something to say, in this order:

| When | Note | Actions |
|---|---|---|
| Offline | "You're offline. What you log is saved on this device and syncs when you're back." / "You're offline · N changes saved on this device, waiting to sync" | – |
| The server refused changes | "N changes couldn't be saved" | Try again · Discard |
| Signed out with changes waiting | "Sign in to sync N changes saved on this device" | Sign in |
| Waiting to try again (server busy) | "N changes are waiting to sync" | Sync now |
| Changes from another account on this device | "N changes from another account are waiting on this device" | Discard |
| Changes that had to wait just went through | "Back online: N changes synced" (4 s) | – |

### Syncing
- **Changes go in the order they were made**, as soon as there's a connection:
  - right away;
  - when the connection comes back;
  - when the app comes back to the front;
  - every 2–30 s while offline.
- **Other devices' changes:** after changes go through, the page's data is reloaded from the server, which also brings changes made elsewhere. Coming back to the front after more than 5 s away does the same.
- **Retries:** a server error or rate limit is tried again, from 2 s doubling up to 5 minutes, 6 times, then it shows under "couldn't be saved".
- **Accounts:** a change keeps the account it was made in. It never lands in another account signed in on the same device.

### Conflicts
- **The later change wins**, by when it was made on the device, not when it reached the server (`entries.edited_at`).
- **An older change that arrives later isn't applied.** The page shows the entry as it is and says "“X” was changed on another device after this, so that change stays."
- **No duplicates:** the same title added on two devices is one entry, since adding a title that's already there changes it.
- **A removal that reached the server is final.** Adding the title again starts a new entry.
- **Logs keep their time:** episode and reading logs keep when they were made, so stats, recaps and challenges count them on the right day. The same episode logged on two devices is one log.

### Privacy
- **Signing out with changes waiting asks first**: "N changes haven't synced yet. Signing out deletes them from this device." → "Sign out anyway". Signing out deletes the waiting changes, kept pages, posters and recent titles from the device.
- **Another account** opening a page with its data on the device clears the kept pages and recent titles. Deleting the account clears everything.
- The Privacy Policy says what the app keeps on the device.
- The installed app asks the browser to keep its storage (persistent storage).

### Online only
Sharing cards, Stamps, follows, joining clubs and challenges, imports, settings, Pro, scene warnings and the warnings quiz ([S3 warnings & quiz](S3-warnings-quiz.md)) stay online-only. The server checks them, or they involve other people.

## Acceptance criteria
- [x] With the network disabled, the installed PWA opens, shows the collection and adds an entry. (`e2e/offline.spec.ts`: the app opens on Home from the device's copy, the Collection link opens the kept collection, quick add adds a title from "Seen lately", and a reload keeps it. Also run against a production build.)
- [x] After reconnecting, the entry appears on a second device within 10 s of the app being foregrounded. (`e2e/offline.spec.ts`)
- [x] Editing the same entry on two offline devices resolves to the later edit, with no duplicates. (`e2e/offline.spec.ts` sends the later edits first, so arrival order would get it wrong. Also `stage3_offline_sync.test.sql`, `src/core/sync/*.test.ts`.)
- [x] PWA installability passes. (Lighthouse 12 no longer has a PWA category, so Chrome's own check was used, CDP `Page.getInstallabilityErrors`: no errors on the production build. By hand: DevTools → Application → Manifest.)

## Data
- `entries.edited_at`: when the entry was last changed, by the device's clock, clamped to the server's now ([data model](../../architecture/data-model.md), migration `20261006090000_stage3_offline_sync.sql`).
- The write routes take the device's time: `editedAt` on entry changes, `watchedAt` on episode logs, `readAt` on reading logs (default now). They also take the `X-Mystonie-User` header.

## Not in this task
- Working out stats and Home's numbers from waiting changes offline (they show the last save).
- Queuing card shares, Stamps, follows, clubs and challenges offline.
- Background Sync (Chromium only; the app sends whenever it's open).
- Searching the catalogs offline.
