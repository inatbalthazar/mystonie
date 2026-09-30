# S2 · Milestones, Monthly Recap, Year in Review

**Stage:** 2 · **Built:** 2026-09-28 ([ADR 0031](../../decisions/0031-milestones-monthly-recap-year-in-review.md))

## Summary
Three more reasons to come back and share, all built on the stats and recap pipeline:
- **Milestone cards**: the 100th title, 1,000 hours, 500 episodes. The Strava "personal record", and the moment the brand is named after (Mystonie = *milestone*, [ADR 0011](../../decisions/0011-name-mystonie.md)).
- **Monthly Recap**: the weekly recap's bigger sibling, on the 1st of the month.
- **Year in Review**: the user's year as album pages and one shareable card. It ships by early December.

## Rules
- **Numbers come from the existing sources:**
  - `titleWatch` and `titleRead` for recaps;
  - `statsReport` for Year in Review;
  - `titleEvents` replayed in time order for milestones.
  So they always match the collection headers and the stats page.
- **Milestones:**
  - Titles finished (all kinds): 10, 25, 50, 100, 250, 500, 1,000, 2,500, 5,000.
  - Hours watched: 24, 100, 250, 500, 1,000, 2,500, 5,000, 10,000.
  - Episodes: 100, 250, 500, 1,000, 2,500, 5,000, 10,000.
  - Reading time is an estimate, so it doesn't count toward hours. Books and manga count as titles.
- **Each milestone is celebrated once.** Only the highest one crossed per metric is shown.
  - For an existing collection, milestones reached before the feature are recorded silently. Only one reached in the last 2 days is celebrated. They can all still be shared from the stats page.
- **Monthly Recap:**
  - It covers a calendar month in the user's time zone and is due on the local 1st from 09:00.
  - It uses the same email, notification, recap page and opt-out as the weekly recap.
- **Recaps now count reading:** activity, an estimated reading-time figure ("hours read") and book and manga covers in the collage.
- **Year in Review** covers a calendar year in the user's time zone.
  - The current year reads "so far".
  - Home points to it from December 1 to January 31.

## As built
- **Milestone flow:**
  - After a finish (quick add, edit, series page, reading page) or an episode log is saved, the client calls `POST /api/milestones`.
  - If a milestone was crossed, its celebration opens once the Finish card closes: "That's your 100th title!"
  - The card opens on the new **Stone** template: the number carved into Stonie's tablet, with the title that got there pasted in below ("Reached with Parasite"). Bold Stats and the Sticker draw it too.
- **Stats page:**
  - A **Milestones** section: every milestone reached, as small stones. Tap one to get its card.
  - On "This year", a link to the Year in Review.
- **Monthly Recap:**
  - The hourly cron route creates monthly recaps next to weekly ones (`weekly_recaps.period = 'month'`).
  - The email and notification say "Your month on Mystonie (September 2026)".
  - `/recap/[id]` opens the card ("My month", Collage first, Bold Stats a swipe away). It is saved as a `monthly_recap` card linked to its recap.
  - Home's note says "Your month is in".
- **Year in Review (`/review/[year]`)**, as album pages:
  - the cover with "Share my year";
  - the numbers (watch time, titles, episodes, reading time, pages / chapters, active days);
  - the top 5 titles as pasted posters;
  - month by month, with the busiest month highlighted;
  - taste and records (the stats page's sections);
  - the first and last finish of the year;
  - the year's milestones.
- **Year in Review card:**
  - It is saved as a `year_review` card and opens on the new **Yearbook** template: the year in huge type, the top posters, the numbers and three standouts (top genre, busiest month, best streak).
  - Bold Stats, Collage and the Sticker draw it too.
- **Share stats cards** also show "hours read" when there was reading in the period.

## Acceptance criteria
- [x] Finishing the 10th title shows its Milestone card after the Finish card, once; the stats page keeps it. (`e2e/milestones.spec.ts`, `src/core/stats/milestones.test.ts`)
- [x] Milestone totals are the collection's totals. (`milestones.test.ts`: same as `summarizeCollection`)
- [x] A user active last month gets a Monthly Recap on their local 1st from 09:00 (email → card), reading included; a month is never recapped twice. (`stage2_milestones_recaps.test.sql`: Bangkok vs New York, reading-only users; `e2e/milestones.spec.ts`)
- [x] Monthly reading time equals the Read tab's header for that month. (`recap.test.ts`)
- [x] Year in Review's numbers equal the stats page's "This year" on the year's last day, and "Share my year" makes a Yearbook card. (`year-review.test.ts`, `e2e/milestones.spec.ts`)
- [x] New templates fit every hard case in both sizes and export as PNGs. (`e2e/cards.spec.ts`: 5 new card-lab fixtures)
- [ ] 🧑 Real-device check of the Stone and Yearbook cards (with the other real-device checks).

## Data
`cards.kind` + `milestone`, `monthly_recap`, `year_review` · `weekly_recaps.period` · `profiles.milestones_seen` (migration `20260928090000_stage2_milestones_recaps.sql`).
