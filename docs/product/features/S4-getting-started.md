# S4 · Getting-started checklist

**Stage:** 4 (owner ideas, 2026-09-30) · **Built** 2026-09-30 ([ADR 0046](../../decisions/0046-getting-started-checklist.md)) · on every page since 2026-10-01 ([ADR 0056](../../decisions/0056-getting-started-button.md))

## Summary
New users see what to do first on every page: a round progress button opens five steps and a progress bar. Each step ticks itself from real data. A new account's first page opens it by itself, once per device ([ADR 0072](../../decisions/0072-getting-started-welcome.md)).

## Behaviour
- **The button** (every signed-in page, bottom right, just above the nav island): a coral ring filling as steps are done, "2/5" inside (a bouncing party popper at 100 %). Hidden on `/import` (its Import bar sits there) and while the phone keyboard is up.
- **The sheet** (tapping the button): "Getting started", "2 of 5 done", a progress bar and the steps:
  1. Add your first title (anything in the collection) → quick add.
  2. Finish one and make a card (a card saved) → the collection.
  3. Pick topics to avoid (any avoid-topic, e.g. the family set) → Settings → Content warnings.
  4. Follow someone or join a club → Find people.
  5. Install the app: seen when Mystonie is opened as the installed app on this device (remembered there). A hint says how; the install prompt below it does the rest.
- Done steps are struck through with a tick and aren't links; open ones link to where they're done, with a one-line hint (the sheet closes on the way).
- **Skip for now** hides the button. **Settings → Getting started → Show the getting-started checklist** brings it back.
- **100 %:** a small celebration ("You're all set!", a party popper, the full bar) until "Nice", then it's gone for good (Settings can show it again).
- Events: `getting_started` `{ action: "opened" | "welcomed" | "skipped" | "completed" }`.

## Acceptance criteria
- [x] The steps tick from real data (collection, cards, avoid-topics, follows or clubs, the installed app). (`src/core/getting-started.test.ts`, `e2e/home.spec.ts`)
- [x] "Skip for now" hides it after a reload; Settings brings it back. (`e2e/home.spec.ts`)
- [x] At 100 % it celebrates once, then goes away.
- [x] No tour: the sheet opens from the button, and by itself only on a new account's first page, once per device ([ADR 0072](../../decisions/0072-getting-started-welcome.md)); mobile-first at 360px. (`e2e/home.spec.ts`)
- [x] The button is on every signed-in page and its count follows steps done anywhere. (`e2e/home.spec.ts`)

## Data
No schema: the step counts come from existing tables, through `GET /api/getting-started` (head-only counts, asked on each page while the checklist is in use) (`entries`, `cards`, `user_avoid_topics`, `follows`, `club_members`). "Skipped", "celebrated" and "installed" are kept in the browser's storage (per device, ADR 0046).
