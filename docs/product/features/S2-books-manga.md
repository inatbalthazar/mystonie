# S2 · Books & manga

**Stage:** 2 · **Built:** 2026-09-27 ([ADR 0029](../../decisions/0029-books-manga-reading-progress.md))

## Summary
Extend the collection to reading: books (Google Books) and manga / manhwa / webtoons (AniList GraphQL). This adds a Read tab to Collection, reading stats, and book/manga card templates (spine, manga panel).

## Rules
- The title `kind` is extended: `book`, `manga`. Sources: `google_books`, `anilist`. Normalizers live in `src/core/catalog`.
- **Length metrics:** books use page count. Manga uses volumes and chapters. **Progress logging** works per chapter or volume (mirrors episode logging) and uses a `progress_logs` generalization or a sibling table, whichever keeps `episode_logs` simple (decided: the sibling `reading_logs`, ADR 0029).
- Stats add pages read, volumes/chapters, and reading vs watching time split.
- Search sheet gets a type switcher: All · Movies & TV · Books · Manga.

## As built
- **Search:** the collection's ➕ sheet opens on **All** (TMDB + AniList + Google Books, merged by how well the name matches, catalogs taking turns). Every result says its kind ("Manga · 1997", "Series · 1999"), and books add their first author. The card maker on `/` still searches movies and series only.
- **Adding:** the status step says Finished / Reading / Want to read for books and manga (stored as `finished` / `watching` / `want`).
- **Reading page** (`/title/book/[id]`, `/title/manga/[id]`):
  - where you are, with a progress bar when the length is known;
  - the estimated reading time so far;
  - **Log chapter N+1** in one tap, or type any page, chapter or volume. Catching up to chapter 1100 is one log;
  - a Chapter / Volume switch for manga;
  - your recent log, with undo.
- **After a log:** a Progress card is offered ("Chapter 1,100", or "Halfway there" at 25/50/75 % when the length is known). At the end, "Finished it? 🎉" leads to the Finish card. "Yes, I finished it" is always there too, e.g. for a running manga you've caught up on.
- **How reading counts:** each log is a checkpoint. It adds how far it moves past the furthest point logged before it. Finishing adds the rest of the way to the end (a book finished without logs counts all its pages).
- **Estimated reading time:** 1.5 min a page, 5 min a manga chapter, 45 min a volume. It is shown as an estimate.
- **Collection:** **Watch · Read** tabs. The Read tab's header shows reading time, finished, and pages / chapters / volumes read (the ones there are). Rows show "Chapter 1,100 / 232 · 91h 40m read" or "Page 120 / 496".
- **Stats:**
  - a reading row under the headline (reading time, pages / chapters / volumes read);
  - "Books & manga" in Taste next to movies and series, which is the reading vs watching split;
  - reading days count in the heatmap and streak.
- **Cards:**
  - Polaroid and Bold Stats draw reading Progress cards.
  - Finish cards for books and manga show pages, chapters and volumes, with a "Finished" stamp. In Thai it reads "อ่านจบแล้ว".
  - The dedicated **Spine** and **Manga panel** templates are a separate roadmap task.
- Weekly recaps don't include reading yet: that comes with the Monthly Recap / Year in Review task.

## Acceptance criteria
- [x] Searching "one piece" returns the manga (AniList) and the series (TMDB), clearly labelled. (`mergeSearch` test with real AniList fixtures; `e2e/reading.spec.ts`)
- [x] Logging chapter 1100 of a manga produces a Progress Card. (`e2e/reading.spec.ts`, `readingProgress` tests)
- [x] Reading stats match the collection totals. (`src/core/stats/reading.test.ts`: Read tab header = `summarizeReading` = stats report, per year and period; e2e checks the same numbers on both pages)
