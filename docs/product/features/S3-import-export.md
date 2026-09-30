# S3 · Import from Goodreads, MyAnimeList and TV Time; CSV export

**Stage:** 3 · **Built:** [ADR 0041](../../decisions/0041-import-export.md) · From [later: import/export](../later/import-export-full.md), extending [S2 Letterboxd import](S2-letterboxd-import.md)

## Summary
Bring a whole history over from the apps people already use, and take it out again.
- **One import page** reads an export from Letterboxd, Goodreads, MyAnimeList or TV Time, or from Mystonie itself. It recognises which app the file came from.
- **CSV export:** the collection as three spreadsheets in a ZIP. Importing that ZIP restores it, into the same account or another one.

## Rules
### Sources
Every reader is a pure function in `src/core/import/`, tested against fixtures laid out like the real exports. Each turns an export into **import items** (`items.ts`): a title, the query that finds it, and what the export says (status, dates, rating, episodes, reading progress).

| Source | Pick | Brings | Found by |
|---|---|---|---|
| Letterboxd | the export ZIP, or its CSVs | films watched (date, rating), the watchlist ([S2](S2-letterboxd-import.md)) | TMDB movies by name + year |
| Goodreads | `goodreads_library_export.csv` | shelf `read` → finished (Date Read, else Date Added) with the rating; `currently-reading` → reading; `to-read` → want. Custom shelves ("did-not-finish") stay behind. Series markers ("(The Hunger Games, #1)") are dropped from titles | Google Books by ISBN-13/10, else title + author |
| MyAnimeList | `animelist_….xml.gz` and/or `mangalist_….xml.gz` (gzip, read on the device) | Completed → finished (finish date, else start date, else **undated**) with the score ÷ 2; Watching/Reading/On-Hold → watching; Plan to → want. Dropped titles and music videos stay behind. A manga being read with a start date brings its chapter (or volume) as a reading checkpoint on that day | AniList by MyAnimeList id (one request per list per batch): manga directly, anime by AniList's English, romanized and Japanese names on TMDB (films on movies, the rest on series) |
| TV Time | the GDPR export ZIP (TV Time closed in July 2026) | every episode checked in, with its time; movies watched (time) or saved for later; followed shows (want). Both file generations (`tracking-prod-records-v2.csv`, `tracking-prod-records.csv`, `seen_episode.csv`, `followed_tv_show.csv`, `user_tv_show_data.csv`). Rewatches keep the latest time; specials (season 0) stay out | TMDB `/find` by TheTVDB id (trusted when the name agrees), else series by name (+ the year TheTVDB adds to namesakes, "Doctor Who (2005)") |
| Mystonie | the CSV export ZIP, or its CSVs (recognised by their headers) | everything exactly: status, finish time, rating, review, episodes, reading logs | the catalog id in each row (no matching) |

- **Only what's needed leaves the device:** names, years, authors, ISBNs and ids. Inside a ZIP, only the known export files are opened. A TV Time export also holds tokens, IP addresses and device data, and those files are never read.
- **Limits:** 5,000 titles per import (the most recent are kept) and 3,000 episodes or reading logs per title.

### Matching
- The Letterboxd rules for films ([ADR 0033](../../decisions/0033-letterboxd-import.md)) apply to every name search, and a title can go by up to two names (an anime's English and romanized ones).
- **Sequels:** a sequel season on MyAnimeList ("Attack on Titan Season 2", "…: The Final Season", "第2期") is the same TMDB series. The season marker is dropped, and so is its year.
- **Books:** editions by the same author count as one book, and Google's most relevant one is taken. Different authors, or no title that agrees, make it a question.
- A manga AniList doesn't know by its MyAnimeList id (or a light novel) becomes a choice from a name search.
- **The preview:** Ready / To check / Not found, as in S2. "Find it" searches the kind the item is (movies, series, both for anime OVAs, books, manga).
- **Merged rows:** rows that land on the same title are joined into one ("N rows are the same title as another row"):
  - the episodes and reading logs are combined;
  - a film or book counts as finished when any row is;
  - a series or manga counts as finished only when every row is. Season 1 completed plus season 2 watching is still watching.

### Saving
- **Batches:** ≤ 25 titles, of which ≤ 5 series with episodes, and ≤ 3,000 logs per request. It waits out rate limits and resumes, as in S2.
- **Idempotent:**
  - a title already in the collection keeps what was logged in Mystonie;
  - its status only moves forward (want → watching → finished);
  - a missing rating or review is filled in;
  - episodes and reading checkpoints already logged are skipped.

  Re-importing the same export adds nothing.
- **Episodes:**
  - only episodes TMDB lists are logged, each with its watch time and TMDB runtime; numbering the catalogs disagree on is left out;
  - a show whose every episode is now out and logged, in an ended series, is finished, dated by its last episode.
- **Dates:**
  - an exact time (TV Time, Mystonie) is kept;
  - a day becomes noon that day in the user's time zone (S2);
  - an **undated** finish (MyAnimeList often has none) is dated **1 January of the title's year**. That keeps years-old finishes out of this week's numbers, this month's challenges and recaps, while the Year in Review still roughly fits. The preview says "Finished (no date, so it's dated by its year)".
- **After:**
  - one "Imported N …" card, counted in films, books, shows or manga when the import is all one kind, else in titles (`recap.importedUnit`). It covers the titles the import finished or logged history for, their watch time and episodes;
  - the summary adds "N episodes logged" and "N reading bookmarks added";
  - milestones, badges and challenges are recorded quietly, as in S2.

### CSV export
- **Settings → Your data → Export as CSV:** `GET /api/account/export/csv` returns `mystonie-<username>-<date>-csv.zip`, stored without compression. It holds:
  - `collection.csv`: kind, source, external_id, name, original_name, year, original_language, genres, status, finished_at, rating, review, added_at;
  - `episodes.csv`: source, external_id, name, season, episode, runtime_min, watched_at;
  - `reading.csv`: kind, source, external_id, name, unit, position, read_at.
- **Format:**
  - UTF-8 with a byte-order mark, so spreadsheets read Thai and Korean names;
  - cells a spreadsheet would run as formulas get a leading `'`, and importing removes it;
  - only live rows (the JSON export keeps deleted ones too).
- **Round trip:** exporting and importing into another account gives the same collection, exactly: statuses, finish times, ratings, reviews and every log.

### Where
- `/settings/import` (was "Import from Letterboxd"): "Where from?" chips pick whose instructions show, and `?from=goodreads` preselects one. The file itself decides the reader.
- Settings: "Coming from another app?"; the empty collection: "Coming from another app? Import your history".
- The Privacy Policy says what an import sends and names the CSV export.
- Analytics: `import_done` now carries `source` (letterboxd, goodreads, mal, tvtime, mystonie) and `titles` (was `films`).

## Acceptance criteria
- [x] A 500-row Letterboxd export imports with ≥ 95% auto-matched (unchanged, [S2](S2-letterboxd-import.md)).
- [x] Goodreads, MyAnimeList and TV Time exports are read into titles with their statuses, dates, ratings, episodes and reading progress. (`sources.test.ts`)
- [x] Books match by ISBN, anime sequels find their series, and TV Time shows find theirs by TheTVDB id. (`match.test.ts`, `catalogs.test.ts`)
- [x] Re-importing creates 0 new entries or logs. (`commit.test.ts`, `e2e/import.spec.ts`)
- [x] Export → re-import round-trips without loss. (`sources.test.ts`, `e2e/import.spec.ts` restores a TV Time import into a second account and compares)
- [x] A show seen to the end is finished by its episodes. (`e2e/import.spec.ts`)

## Data
No new tables or migration. `recap.importedUnit` is added to the stats card's params (validated in `src/core/cards/saved.ts`).

## Not in this task
- TV Time ratings and reactions, Goodreads reviews (HTML, longer than 280 characters), MyAnimeList episode counts without dates as episode logs (they would all be dated today and fill this week's numbers), dropped titles.
- Importing another user's export into yours in one step (sharing), and scheduled or automatic syncing from other apps.
- Trakt, Serializd, StoryGraph and AniList exports (the readers are one file each when someone asks).
