# ADR 0048: Reel of the Day: a UTC day, picked and graded on the server, guests in the browser

**Status:** Accepted · **Date:** 2026-09-30

## Context
Roadmap stage 4 asks for a daily movie game ([S4 Reel of the Day](../product/features/S4-daily-reel.md)): one movie a day for everyone, six guesses, a clue after each miss, a spoiler-free share with streaks. Choices: what "a day" is, who picks the movie, how much the browser may know, and whether guests can play.

## Decision
- **The day is UTC** (`reelDay`), numbered from 2026-09-30. Everyone has the same reel at the same moment, so a shared "#12" always means one movie.
  - Rejected: the player's local date (Wordle's way). Then the server must accept two or three "todays" at once, and two friends in different zones share different #12s for hours.
- **The server picks the reel lazily**, on the day's first `POST /api/reel`: a page of TMDB's `/discover/movie` by vote count (25 pages, 500 movies; the page and the pick come from a hash of the date), skipping movies that were a reel before and those without a poster. It is stored in `daily_reels`; concurrent first requests pick the same movie and the insert ignores the duplicate.
  - Rejected: a pg_cron job picking at midnight. It needs the site URL and a secret in Vault (like the recaps) and still needs the lazy path when it fails.
  - Rejected: a fixed list in code. It would need curating and would leak every future answer in the source.
- **The answer stays on the server until the play is over.** RLS hides today's `daily_reels` row from every client (only days that are over are readable). The API grades guesses and sends only the open clues; the poster goes through `/api/reel/poster` (no TMDB path in the page), small while blurred. The blur itself is CSS: a determined player can open the image file, as Wordle's answer sits in its script. No server-side blurring (it would need an image library: a new dependency) for a game with nothing at stake.
- **Signed in: the server keeps the play** (`reel_plays`, written by the service role only): a device can only add guesses to the stored ones (`mergeReelGuesses`), the streak is set when the play ends, and cards are checked against the play before saving. **Guests play too**, their guesses kept in `localStorage` and sent whole with each request (the server grades them statelessly), because a daily game spreads through people who don't have an account yet; signing in carries the guesses over.
- **Sharing:** text first (Wordle's loop: squares in any chat), plus a card kind `reel` with its own template for signed-in players. The card has no poster and no title name (`parseCardData` refuses a poster on a reel card).

## Consequences
- The two tables and the card kind must be on the remote project before this code deploys.
- The pool is ~500 movies: about 16 months of reels without a repeat; widen `REEL_POOL_PAGES` before then.
- A guest's result can't become a card or a streak until they sign in.
