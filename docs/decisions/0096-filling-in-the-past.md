# ADR 0096: Quick add says the past counts: when it was finished, before the tap, and a quiet way to fill in years

**Status:** Accepted · **Date:** 2026-10-05

## Context
The owner (2026-10-05) found that people don't understand the ➕ can add what they finished long ago. A review of quick add showed why:
- Every line spoke of now: "What did you just finish?", "Start with the last thing you watched."
- The finish date sat under the **Finished** button, small and grey, so the tap came first and dated the title today.
- The field wanted an exact day, which nobody remembers for a film seen years ago.
- Every finish opened the celebration, so adding twenty old titles meant closing it twenty times.
- The import (Letterboxd, Goodreads, MyAnimeList, TV Time) wasn't offered in the sheet.

## Decision
**When did you finish it?** sits above the Finished button, as four segments: **Today** (the default), **Yesterday**, **Pick a day** (the date field, its picker opened), **Years ago** (a year list).
- The button says the choice: "Finished today", "Finished yesterday", "Finished on May 1, 2024", "Finished in 2019".
- **Years ago** first offers the title's own year. A year alone is dated **1 January at noon** in the user's time zone, as imports date an undated finish ([ADR 0041](0041-import-export.md)), and the sheet says so ("Counted on 1 January of that year.").
- The choice is kept from one title to the next while the sheet is open.
- `FinishWhen`, `finishedAtFor` and `isPastFinish` in `src/core/collection/entries.ts`.

**Filling in the past.** A finish from before yesterday (a picked day two or more days back, or a year) is pasted in quietly:
- no celebration;
- the sheet goes back to an empty search, with a strip counting what was pasted in ("2 pasted in"), its posters, and **Done**;
- milestones and stickers it earned show once the sheet closes;
- its card can still be made from the collection's edit sheet.

Today's and yesterday's finishes are celebrated as before, still three taps from the ➕.

**Copy.** The search says "What have you finished?"; the hint and the empty collection say the past counts ("from last night or years ago"); the getting-started step says "from today or years ago"; the sheet links to the import.

**Rejected:**
- A stored precision (`finished_precision`: day or year), to show "2019" instead of "Jan 1, 2019". It would need a migration and a change everywhere a finish date shows (rows, cards, title pages, export). Imports already date a year as 1 January without one, and the sheet says how it's counted. Worth revisiting if people mind the date.
- Celebrating every finish. A card for a film seen in 2012 isn't news, and the celebration stopped people adding more.
- A "Don't remember" choice with no year. Every finish needs a date (`entries_finished_at_matches_status`), and the title's year, offered first, is the same guess.

## Consequences
- No schema change.
- e2e tap **Finished today** (it was **Finished**); `e2e/collection.spec.ts` adds the past in a row.
