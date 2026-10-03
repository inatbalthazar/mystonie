# S3 · Badges (stickers) and the Shelf

**Stage:** 3 · **Built:** [ADR 0038](../../decisions/0038-badges-and-shelf.md) · Started from [later: badges & shelf](../later/badges-and-shelf.md)

## Summary
The album gets stickers: **badges** earned from what you finish ("Rookie Bookworm", "Fear Conqueror", "Triple Feature"). A public profile gets a **Shelf** that shows everything its owner finished: posters as cases, books and manga as spines, games as game cases.

## Rules
- **Catalogue** (35 badges, code in `src/core/badges.ts`; names are English in every locale, like template names):

  | Group | Badges |
  |---|---|
  | Firsts | Opening Night (1 movie), Season Finale (1 series), First Chapter (1 book), First Volume (1 manga), Player One (1 game) |
  | How much | Film Buff (25 movies), Binge Master (10 series), Rookie Bookworm (5 books), Bookworm (25 books), Manga Marathon (10 manga), Level Up (10 games), Triple Feature (3 movies on one local day) |
  | Taste | K-drama Fan (5 Korean series), Anime Fan (10 Japanese animation movies or series), Fear Conqueror (10 horror), Laugh Track (10 comedy), Stargazer (10 sci-fi), Hopeless Romantic (10 romance), Sleuth (10 crime / mystery / thriller) |
  | Range | Subtitles On (5 original languages), Genre Hopper (10 genres), All-Rounder (4 kinds of title: movies, series, books, manga or games) |
  | Reel of the Day ([ADR 0063](../../decisions/0063-more-stickers.md)) | Reel Rookie (first solve), One Take (with the first guess), Sharp Eye (10 solved in ≤ 3 guesses), Hot Streak (7 days in a row), Reel Legend (30 days in a row; the hardest, with a gold rim) |
  | Monthly challenges | Challenger (the first), Clean Sweep (all 4 of one month), Season Pass (6 different months) |
  | Warnings quiz | Spotter (first answer), Lookout (10), Sentinel (50), Guardian (100), Lighthouse (250, rare), Final Say (your answer settled a question), On Duty (7 days in a row): a yes or a no, not too fast ([ADR 0094](../../decisions/0094-quiz-rewards.md)) |
  | Writing | Critic (reviews on 10 finishes), Byline (a published Journal article with your username as `profile`) |
  | Support | Supporter (Pro that was paid for, or a Buy Me a Coffee tip with the account's email) |

  Games ([S3 games](S3-games.md)) added Player One and Level Up, and count as a kind for All-Rounder.

- **Finishes** (the first four groups): entries with status `finished` and a date. Genres and languages come from the title's catalog data. The other groups come from the user's own Reel plays, completed challenges, quiz answers, reviews, Pro and Journal byline, and have no title ([ADR 0063](../../decisions/0063-more-stickers.md)); a tip's Supporter sticker comes from the Buy Me a Coffee webhook.
- **Awarded by the server only**, once per person and badge, dated at the finish that met the rule, with that title.
  - It happens after every finish or log (the check that also finds milestones), after an import (quietly), when the stats page renders (quietly), when a signed-in Reel play ends and after a quiz answer.
  - Awards are never taken back: deleting the finishes behind one keeps it.
- **Celebration:** a "New sticker!" toast above the nav island, after the Finish and Milestone cards close.
  - It shows the sticker(s) landing with the stamp animation (none with reduced motion), "for finishing <title>", and "See your album".
  - It stays until closed.
  - On someone's first check (a collection that existed before badges), only badges earned in the last 2 days are celebrated.
- **Sticker album** (`/stats`, "Sticker album"): every badge in catalogue order; with nothing finished it shows once a sticker is earned.
  - Earned ones are stuck in at a tilt; the rest are dashed spots with their progress ("5 of 25").
  - Tap one for how it is earned, and when and with which title (or a progress bar).
- **Profile** (`/u/[username]`):
  - **Stickers**: the awarded ones, compact, with "8 of 22"; tap for details.
  - **The shelf**: the newest 48 finishes as cases, spines and game cases (the art under a platform band) on wooden shelves, then "+ N more finished".
    - Two shelves show until "Show all" ([ADR 0069](../../decisions/0069-arrange-the-album.md)).
    - Up to 4 favourites the owner pinned ("Pick favourites" on Me) stand first, each with a star.
  - Both are hidden on private and blocked profiles (RLS).
- **Following feed:** a finish that earned a sticker has it stuck on the card's corner, with "Earned the … sticker".
- The data export includes the awarded badges. Analytics: `badge_earned` (`badge`: slug) when the toast shows.

## Acceptance criteria
- [x] Adding the 5th book awards "Rookie Bookworm" exactly once. (`src/core/badges.test.ts`, `e2e/badges.spec.ts`)
- [x] Deleting entries does not revoke badges. (`supabase/tests/database/stage3_badges.test.sql`, `badges.test.ts`: the album keeps awarded ones)
- [x] The Shelf is visible on public profiles and hidden for private ones. (`e2e/badges.spec.ts`)
- [x] Clients can't award, change or remove badges; badges of private or blocked profiles can't be read. (`stage3_badges.test.sql`)

## Data
`user_badges` (server-written only). See the [data model](../../architecture/data-model.md).

## Not in this task
- Badge unlocks as their own Following feed items, and badges on share cards. Stickers show on the finish's feed card instead.
- Badges from episodes or reading logs.
