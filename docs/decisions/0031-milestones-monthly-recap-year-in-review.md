# ADR 0031: Milestones announced once, monthly recaps in the recap table, Year in Review as a report

**Status:** Accepted · **Date:** 2026-09-28

## Context
The roadmap's stage 2 task "Milestone cards, Monthly Recap, Year in Review (ship by early December)" had no spec. The brief lists milestones as "the 100th title, 1,000 hours", Monthly Recap next to the weekly one, and Year in Review as the stage's "Wrapped". The spec [S2 milestones & recaps](../product/features/S2-milestones-recaps.md) was written with this ADR.

Constraints:
- A solo founder: no new services, and as few new tables and jobs as possible.
- Numbers must match the collection and stats page, as every earlier card's do.
- Cards render in the browser ([ADR 0008](0008-client-side-card-rendering.md)).

## Decision
**Milestones are computed, not stored. Only "what was announced" is stored.**
- `reachedMilestones` (`src/core/stats/milestones.ts`) replays `titleEvents` in time order. It returns each round number crossed, when, and the title that crossed it. The totals are therefore `summarizeCollection`'s all-time totals.
- `profiles.milestones_seen` (a small jsonb, `{ "titles": 100, "hours": 250 }`) holds the highest milestone announced per metric.
- `POST /api/milestones` compares, returns the new ones as card inputs, and updates the column (the owner's column grant).
- Rules:
  - Only the highest new milestone per metric is announced.
  - A metric never announced before (an existing collection) is recorded silently, unless its milestone was reached in the last 2 days.
  - Deleting entries never "un-reaches" one.
- **The client asks after the save**, from the few places that finish or log: quick add, edit, the series page, the reading page. The milestone celebration waits for the Finish card to close.
- Rejected: returning milestones from every write route. That would mean the same all-rows read in four routes.
- Rejected: a `milestones` table. A computed list can't go stale, and the stats page lists every milestone from the rows it already reads.
- Rejected: counting reading time toward hours. It is an estimate, and watch time stays watch time ([ADR 0029](0029-books-manga-reading-progress.md)).

**Monthly recaps live in `weekly_recaps`, with a `period` column.**
- `week_start` now means the period's first local day. The check is: a Monday for a week, the 1st for a month. The unique key is (user, period, start).
- `monthly_recap_candidates` mirrors the weekly function: the local 1st from 09:00, the month before, active in it.
- Both candidate functions now share `private.active_between`, which also counts reading logs.
- The same hourly job and route create both kinds. Email, push, the recap page and the opt-out (`email_recaps`) are shared, and the copy follows `recap.period`.
- Rejected: renaming the table to `recaps`. Nothing is in production yet, but the rename would touch every recap function, test and query for a name. This is noted here instead.
- Rejected: a separate monthly job or a user setting for the day. Q2's fixed schedule stands.

**Recaps and stats cards count reading.**
- `periodRecap` (week or month) adds `titleRead` for books and manga: activity, an optional `readMinutes`, and covers in the collage.
- `recapFigures` shows at most three figures (watch time, reading time, then finishes; episodes give way first), so the card rows and emails fit.

**Year in Review is `statsReport` for one year, not a new pipeline.**
- `yearInReview` calls `statsReport` with the period "year" at the year's last instant (or now, for the running year). It adds the first and last finish, the year's milestones and the card's highlights: top genre, busiest month, best streak.
- The page `/review/[year]` renders on the server from rows already read for the stats page. Home links to it from December 1 to January 31. The current year is always reachable ("so far").
- Rejected: a pre-computed yearly snapshot through the cron. The live report is cheap (one user's rows) and always current.
- Rejected: an email blast on December 1. Resend's free tier and consent go through the owner; the Home note does the job for now.

**Three card kinds and two templates.**
- `milestone` (data: `CardData.milestone`, the crossing title as name and poster), `monthly_recap` (a recap with `period: "month"`, linked to its recap) and `year_review` (a recap with `period: "year"` and `highlights`).
- Like recap and stats cards, none of them have an entry or a log. The database check `cards_recap_has_no_source` covers all of them.
- Templates:
  - **Stone** (milestones): a carved tablet with Stonie. It is stone-coloured whatever the poster.
  - **Yearbook** (Year in Review).
  - Bold Stats and Collage draw the new recap kinds, and Bold Stats draws milestones. Bold Stats gives a single number the full row.
- Rejected: saving these as `stats` cards. Kinds are what the gallery, analytics and validation key on ([ADR 0026](0026-stats-page.md) made the same call).

## Consequences
- The remote project needs `20260928090000_stage2_milestones_recaps.sql` (after the stage 1 and 2 migrations).
- Monthly recaps add one email a month per active user on Resend's free tier ([ADR 0025](0025-weekly-recaps.md)'s sums): about 5.3 recap emails a month instead of 4.3 (+23 %).
- On a 1st that is also a Monday, users get two recaps (week and month). That is acceptable. Merging them can come later.
- `POST /api/milestones` reads the user's whole collection each time. That is fine at stage 2 sizes (a few thousand rows). If it gets slow, cache the totals.
- Milestones are local-date stamped at the crossing event. A backdated finish can cross a milestone "in the past", and the card shows that date.
