# S4 · Reel of the Day (daily movie game)

**Stage:** 4 (owner ideas, 2026-09-30) · **Built** 2026-09-30 ([ADR 0048](../../decisions/0048-reel-of-the-day.md))

## Summary
A daily movie game, the owner's "Wordle for movies": one movie a day for everyone, six guesses, and each wrong guess reveals a clue. The result shares as spoiler-free squares (text) or a card, with streaks and stats for signed-in players. It uses what the app already has (posters, search, credits, cards) and works in every language: no English-letter grid.

## Behaviour
- **`/reel`**, public: signed out or in. Linked from Home (a note with today's number and where you are, and the Reel shortcut, [ADR 0078](../../decisions/0078-community-on-home.md)) and the sitemap.
- **One reel a day, the same for everyone:** a new one at midnight UTC, numbered from #1 on 2026-09-30. The server picks it on the day's first request, from TMDB's best-known movies (the top 500 by votes, no documentaries or TV movies), one with a poster that was never a reel before. Every server picks the same movie for a day (a hash of the date), and the database keeps one row.
- **Clues:** a blurred poster from the start. After each wrong guess the poster sharpens and one clue opens: year, then genre, top-billed actor, director, tagline (from the title's credits, [S4 deeper stats](S4-deeper-stats.md)). A clue the movie lacks says "Not known". Everything opens when the play is over.
- **Guessing:** from our movie search, so spelling never costs a try. The same movie can't be guessed twice. A hit ends the play; six misses too. The page then shows the answer (linking to its title page), "Got it in 3 guesses!" or "Out of guesses", and a countdown to the next reel.
- **The answer stays on the server** until the play is done: the page gets the open clues and the poster through `/api/reel/poster` (tiny while blurred: w92, then w185, w342 at the end), never the name or TMDB's image path. Like Wordle, someone who opens the poster file itself sees it unblurred; nothing is at stake.
- **Sharing:** "Share result" opens the share sheet (or copies) with `Reel of the Day #12 3/6`, the squares (🟥🟥🟩), the streak (🔥 4, signed in) and the link: never the movie. Signed in, "Make a card" opens the celebration with the Film Frames card (a contact sheet of six frames, red misses and a green hit, the number, the score and the streak; no poster, no name) and its sticker.
- **Signed in:** the server keeps the play, so it follows the player across devices (a device can only add guesses to it), and shows the stats once the play is over: played, win %, streak, best streak and how many guesses the wins took. A streak is wins on consecutive days; a miss ends it. Guests keep today's guesses in the browser; signing in later brings them along.
- **Yesterday's reel** (its poster and name) is on the page for everyone.
- **Reminders** ([ADR 0054](../../decisions/0054-feed-dot-reel-reminders.md)): in the installed app, with notifications on, Settings → Notifications → "Reel of the Day reminders" (off by default). One push on a day whose reel would end a streak of 2 or more (won yesterday, today not finished), at the player's last daytime hour (09:00–21:59 on their clock) by 21:00 UTC, so at least 2 hours before the reel changes: "🔥 Keep your 5-day streak" / "Today's Reel of the Day ends in 9 hours." Tapping it opens `/reel`. Once a day at most.
- **Events:** `reel_finished` `{ solved, guesses }`, `reel_shared` `{ channel }`; the card as `card_shared`/`card_downloaded` (`card`: reel).

## Acceptance criteria
- [x] Everyone gets the same movie each UTC day, never a repeat. (`src/core/reel.test.ts`, the picking)
- [x] Six guesses from search; each miss opens the next clue and sharpens the poster; the answer never reaches the page before the play ends. (`reel.test.ts`, `e2e/reel.spec.ts`)
- [x] A spoiler-free share (text and card) with the streak. (`reel.test.ts`, `saved.test.ts`, `e2e/reel.spec.ts`)
- [x] Streaks and stats per signed-in player, kept by the server; guests can play. (`stage4_daily_reel.test.sql`, `e2e/reel.spec.ts`)
- [x] Yesterday's answer revealed.
- [x] Mobile-first at 360px, dark mode checked.
- [x] Opt-in reminders: only a streak of 2+ at risk, once a day, at the player's hour in any time zone. (`reel.test.ts`, `stage4_reel_reminders.test.sql`, `e2e/reel.spec.ts`)

## Data
`daily_reels` (`day` PK, `number`, `title_id`) and `reel_plays` (one per player and day: `guesses`, `solved`, `finished_at`, `streak`), migration `20261010090000_stage4_daily_reel.sql`; cards take the kind `reel`. Reminders: `profiles.reel_reminders`, `profiles.reel_reminded_on` and `reel_reminders_due()`, migration `20261013090000_stage4_reel_reminders.sql`. See the [data model](../../architecture/data-model.md). Both tables must be on the remote project before this code deploys.
