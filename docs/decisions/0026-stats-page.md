# ADR 0026: Stats page: server-rendered CSS charts, and "Share stats" as a `stats` card

**Status:** Accepted · **Date:** 2026-09-27

## Context
[S1 stats](../product/features/S1-stats.md) asks for a Strava-like stats page:
- headline numbers, an activity heatmap, a per-month chart, taste (genres, movies vs series, languages) and records;
- periods: this week, this month, this year, all time, in the user's time zone;
- numbers that match the collection summary, rendering in under 1 s with 1,000 entries;
- a "Share stats" button that makes a Bold Stats card for the period.

The spec and the stack list Recharts for charts. Recharts is not installed yet.

## Decision
- **All numbers come from `statsReport`** (`src/core/stats/report.ts`).
  - It splits each title's watching into dated events by `titleWatch`'s rules, so the headline is `summarizeCollection` for the same range. A test checks this for every period and several time zones.
  - The heatmap always covers the last 53 weeks, and the chart the last 12 months, whatever the period: they give context. Taste and records follow the period.
  - "Longest series finished" ranks series finished in the period by their whole watch time.
- **The page is one server render per period** (`/stats?period=week|month|year|all`, this month by default). The period tabs are links, and the rows are read once through RLS (`src/data/stats.ts`).
- **The charts are plain elements, not Recharts.**
  - The heatmap is a grid of squares and the months are bar heights. Both are coloured with theme tokens (`brand`, `chart-*`), so dark mode works as-is.
  - They ship no client JavaScript and add no dependency. They are also easy to style as album pages.
  - Rejected: Recharts. It would add a client bundle (about 100 KB gzipped) for one bar chart and one calendar, and a client component per chart.
  - Recharts stays in the stack for charts that need interaction (e.g. a future Year in Review).
- **"Share stats" reuses the recap card.**
  - The `CardRecap` snapshot gets an optional `period`. With it, the headline, range (with the year) and "titles" line follow the period ("My month", "5 titles this month"). Without it, the card is a weekly recap, as before.
  - Cards are saved as a new kind, `stats` (migration `20260927140000_stage1_stats_cards.sql`). Like a recap card, a stats card has no entry or episode log. It opens in Bold Stats, with Collage as the other style, and the Sticker works as for other cards.
  - Rejected: saving these as `weekly_recap` cards. That would mix two meanings in `cards.kind`, and the recap rules (such as linking to `weekly_recaps`) would not fit.
  - Rejected: a separate stats-only template. Bold Stats already draws a recap.

## Consequences
- The remote project needs the new migration along with the other stage 1 migrations.
- Stats cards are snapshots: a shared all-time card keeps the numbers from the day it was made.
- The record limits in `parseRecap` were raised (minutes up to 10,000,000), so all-time totals fit.
