# S2 · Books & manga

**Stage:** 2

## Summary
Extend the collection to reading: books (Google Books) and manga / manhwa / webtoons (AniList GraphQL). This adds a Read tab to Collection, reading stats, and book/manga card templates (spine, manga panel).

## Rules
- The title `kind` is extended: `book`, `manga`. Sources: `google_books`, `anilist`. Normalizers live in `src/core/catalog`.
- **Length metrics:** books use page count. Manga uses volumes and chapters. **Progress logging** works per chapter or volume (mirrors episode logging) and uses a `progress_logs` generalization or a sibling table, whichever keeps `episode_logs` simple (decide in an ADR).
- Stats add pages read, volumes/chapters, and reading vs watching time split.
- Search sheet gets a type switcher: All · Movies & TV · Books · Manga.

## Acceptance criteria
- [ ] Searching "one piece" returns the manga (AniList) and the series (TMDB), clearly labelled.
- [ ] Logging chapter 1100 of a manga produces a Progress Card.
- [ ] Reading stats match the collection totals.
