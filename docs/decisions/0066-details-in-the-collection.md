# ADR 0066: A collection entry's sheet shows the title's details, as the ➕ sheet does

**Status:** Accepted · **Date:** 2026-10-01 · Extends [ADR 0058](0058-look-before-you-add.md)

## Context
The owner asked for every item in the collection to show its details the way "Add a title" does.

Until now:
- Tapping an entry opened a sheet with only its status, finish date, "Make a card" and a link to the title's page.
- The poster, the warning note and "Details and content warnings" were on the ➕ sheet's status step only ([ADR 0058](0058-look-before-you-add.md)).

## Decision
The entry's sheet opens the way the ➕ sheet's status step does. The sheet's title stays the title's name. Under it, in order:
1. **The title:** its poster, tilted like the ➕ sheet's (a game's key art landscape), its kind and year, and its genres.
2. **"Details and content warnings":** the same `TitleDetails` component. It has:
   - the warning note at once, from the row's badge for the viewer's avoid-topics, with no request;
   - on a tap, `GET /api/titles/preview/{kind}/{id}`.
3. **Then, unchanged:** status, finish date, "Make a card", the title's page, Save and Remove.

**Same quota rule as ADR 0058:** the details load only on request, so opening an entry to change its status costs no DTDD lookup.

**Rejected: loading the details as soon as the sheet opens.** It would spend DTDD's quota on every status change.

## Consequences
- `TitleDetails` now takes any `{kind, externalId}`, so a search result or a collection title both work. No new route, migration or message.
- `e2e/warnings.spec.ts` (the ADR 0058 test) opens the added title from the collection. It checks:
  - the note;
  - the details on a tap;
  - the warning chips;
  - that no DTDD request was made.
