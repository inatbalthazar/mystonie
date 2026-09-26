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
- Periods use the user's time zone.
- Charts use Recharts, with colours defined as theme tokens and readable in dark mode.
- A "Share stats" button creates a Bold Stats card for the selected period.

## Acceptance criteria
- [ ] Numbers match the collection summary for the same period.
- [ ] The page renders in < 1 s with 1,000 entries.
- [ ] The empty state points to "Log your first title".
