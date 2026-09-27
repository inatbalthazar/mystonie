# S1 · Stats

**Stage:** 1

## Summary
A Strava-like stats page with big, bold numbers first, then charts.

## Content
- **Headline numbers:** hours watched, titles finished, episodes watched (selected period).
- **Activity heatmap:** a calendar of days with logs (GitHub-style).
- **Per month:** finishes and hours (bar chart).
- **Taste:** top genres, movies vs series, top original languages (e.g. English, Korean, Japanese).
- **Records:** longest movie, longest series finished, busiest month, longest daily streak.
- Periods: this week, this month, this year, all time.

## Rules
- All numbers come from pure functions in `src/core/stats` (unit-tested). Components only render.
- Periods use the user's time zone: `periodRange(period, { timeZone, weekStart, offset })` in `src/core/stats/period.ts` gives UTC bounds [from, to) for this week / month / year (`offset: -1` = the previous one), handling DST. The week starts on the locale's first day (`weekStartFor(locale)`: Sunday for `en`, Monday where CLDR says so). Headline numbers come from `summarizeCollection` with that range, so they match the collection summary.
- Charts use theme-token colours and are readable in dark mode. They are server-rendered elements, not Recharts ([ADR 0026](../../decisions/0026-stats-page.md)).
- A "Share stats" button creates a Bold Stats card for the selected period (card kind `stats`, ADR 0026).

## As built ([ADR 0026](../../decisions/0026-stats-page.md))
- **Page:** `/stats?period=week|month|year|all` (this month by default), signed in. The header has a Stats link.
- **Numbers:** `statsReport` in `src/core/stats/report.ts`, from the rows in `src/data/stats.ts`.
- **Sections:**
  - The period's headline, with Share stats.
  - Activity: the last 53 weeks. On phones it scrolls sideways, starting at today.
  - Per month: watch time for the last 12 months, with the number of titles finished under each month.
  - Taste: movies vs series by watch time, top 5 genres, top 5 original languages (named with `Intl.DisplayNames`).
  - Records: longest movie, longest series finished (by total watch time), busiest month and longest daily streak. Each shows "Not yet" when there is none.
- **Share stats** opens the celebration with the period's card: Bold Stats first, then Collage, plus the Sticker. The card says "My month", "5 titles this month", and the range with its year.
- **Empty state:** with nothing logged, the page shows "Log your first title", which opens the quick-add sheet. A period with nothing in it says so under the headline.
- **Tests:**
  - `report.test.ts`: headline = `summarizeCollection` for every period and zone; months, heatmap, taste, records, the card; 1,000 entries + 20,000 logs in under 500 ms.
  - `saved.test.ts` (stats cards) and `stage1_stats_cards.test.sql`.
  - `e2e/stats.spec.ts`: empty state → finish → all-time numbers equal the collection header → Share stats saves a `stats` card.

## Acceptance criteria
- [x] Numbers match the collection summary for the same period. (`report.test.ts`, `e2e/stats.spec.ts`)
- [x] The page renders in < 1 s with 1,000 entries. (The report takes < 500 ms for 1,000 entries and 20,000 logs in the unit test. It is one server render, and the charts need no client JavaScript.)
- [x] The empty state points to "Log your first title".
