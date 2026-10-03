# ADR 0094: Warnings quiz rewards: more stickers, final says, a day streak and rounds of five

**Status:** Accepted · **Date:** 2026-10-03

## Context
The owner (2026-10-03): people who answer the warnings quiz should get more for it, and the quiz page should be less dull and more worth coming back to.

Until now the quiz paid two stickers, Lookout (10 answers) and Guardian (100) ([ADR 0063](0063-more-stickers.md)). The page was one question after another, with a count of this visit's answers.

Gems stay gated ([ADR 0036](0036-expansion-features-before-launch.md)), so the rewards can't be currency.

## Decision
**Five more stickers, all computed by the server from the user's own rows** (`evaluateBadges`, awarded with the service role as before):

| Sticker | Rule |
|---|---|
| Spotter | the first answer |
| Lookout, Guardian | 10 and 100 answers (unchanged) |
| Sentinel | 50 answers |
| Lighthouse (rare) | 250 answers |
| Final Say | your answer settled a question (the tenth counted one) |
| On Duty | answers on 7 days in a row, in the user's time zone |

An answer still means a yes or a no that wasn't too fast. Spotter makes the first answer pay at once.

**Final says need no schema change.** `quiz_answer` sets the answer's `answered_at` and the question's `resolved_at` with the same `now()`, so an answer whose time equals its question's `resolved_at` is the one that settled it. `quizHelps` (`src/data/badges.ts`) reads the newest 1000 answers with their question's `resolved_at`. The streak's days follow `profiles.time_zone`; the quiz route passes it when it awards stickers.
- Rejected: a column marking the deciding answer. It would need a migration on the remote project, and the timestamps already say it.

**Who an answer helps** (added the same day at the owner's request): each question says how many people on Mystonie avoid its topic ("12 people on Mystonie avoid this. Your answer helps them decide."), and the round's end says the most an answer reached. The count comes from `topic_avoiders(p_topic)` (migration `20261025090000_stage4_topic_avoiders.sql`): people with the topic in their avoid-topics, not counting the caller, a total only, and 0 under 3 so a small number can't point at someone. Until the migration is on the remote project, the call fails quietly and the line doesn't show.

**The page** (`src/components/warnings/warnings-quiz.tsx`, standing from `src/core/quiz-standing.ts`):
- **The lookout log** at the top: answers, final says and days in a row. Each number pops when it changes. Below them, the ladder of the five answer stickers (earned ones stuck on, the next one ringed) with a bar to the next one, and a line about the streak ("Answer one today to keep your 3-day streak").
- **Rounds of five:** dots and "Question 2 of 5"; the card sits on a little stack of the questions left. An answer stamps the card (Yes, No, Pass) before the next one is dealt. Reduced motion skips the stamp and the wait.
- **The end of a round:** Stonie, what the round did (answers that helped, final says, warnings confirmed, the streak), the next sticker, then "Another round" or "Done for now". The next question is fetched only on "Another round", so nothing is served that won't be shown.
- **A settling answer** gets its own note ("Final say! Your answer settled it…").

**Home's quiz note** says what's at stake today: a streak that ends tonight, today's done, or the answers left to the next sticker, with that sticker's empty spot.

## Consequences
- The stickers need no migration; the avoiders count needs `20261025090000_stage4_topic_avoiders.sql` on the remote project (the owner's go). The stickers are awarded on the next quiz answer or sticker check, including for answers given before (badges are evaluated by replaying history).
- Home reads the quiz answers once more per load (only for someone who has finished something).
- The rules' numbers live in `BADGES`; the page reads its ladder and streak length from there.
