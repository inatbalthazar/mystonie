# ADR 0072: The getting-started checklist opens by itself on a new account's first page

**Status:** Accepted · **Date:** 2026-10-02 · Changes [ADR 0056](0056-getting-started-button.md) ("It never opens by itself")

## Context
ADR 0056 kept the checklist behind its round button and rejected opening it uninvited. The owner (2026-10-02) wants the getting-started sheet to show from the first sign-in, as soon as a new account comes in.

## Decision
- **When:** the first signed-in page opens the checklist's sheet by itself, for an account that has done nothing yet:
  - no entries, cards, topics, follows or clubs;
  - installing the app doesn't count.
- **Once on each device** (`mystonie.gettingStarted.welcomed` in `localStorage`, like "skipped"). After that it waits behind the button as before.
- **An account already under way never gets it:** its first page on a device marks the welcome as done without opening.
- **Not over another sheet:** if one is already open (quick add from `?add=1`, say), it waits for a later page. It doesn't open on pages without the button (`/import`).
- **Closing:** Close, the backdrop and the drag down all just close it. "Skip for now" still hides the button.
- **Events:** `getting_started` gains `action: "welcomed"`.

Rejected:
- **A tour overlay** (ADR 0046): still no. This is the same sheet the button opens.
- **Opening on every page until something is done:** a sheet that keeps coming back blocks the app.
- **Remembering the welcome on the server:** it would need a column and a migration. Once per device is close enough: a new account's second device opens it once more only if nothing has been done yet.

## Consequences
- `e2e/helpers.ts`: `signUp` marks the welcome as seen (`skipWelcome`), so other tests' first page isn't covered by the sheet. `e2e/auth.spec.ts` does the same.
- `e2e/home.spec.ts` checks that the welcome opens, closes, and stays closed after a reload.
