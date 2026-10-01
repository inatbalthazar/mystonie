# S3 · Games

**Stage:** 3 · **Built:** [ADR 0044](../../decisions/0044-games-rawg.md) · From the gated "Games" row in [later](../later/README.md) and [ADR 0005](../../decisions/0005-hltb-via-edge-function-cache.md) (superseded) · Data from [RAWG](../../architecture/external-apis.md)

## Summary
Games join movies, series, books and manga as a fifth kind of title. People find them in the same search, keep them on their own **Play** tab, and finish them with the same celebration. The card is a cartridge taped into the album, with the hours it took. Play time shows in stats and recaps, apart from watch time.

## Rules
### Finding and adding
- **Search:** the ➕ sheet gets a **Games** switch (All · Movies & TV · Books · Manga · Games).
  - Best known first: names with every word typed, then the games most people added on RAWG. "zelda" gives Breath of the Wild, not a fan game called Zelda. The Games switch lists 20.
  - "All" includes games from 3 characters, the 8 best known. Each catalog's first pick stays near the top, so "zelda" in All shows the game among the movies and manga called Zelda.
  - Results say "Game · 2015" with the platforms ("PC, PlayStation, Xbox").
  - Adult games (RAWG's nsfw and hentai tags) aren't listed, and DLC isn't either (the base game is what people finish).
- **The status step** shows the game's art landscape, its platforms, and **Finished · Playing · Want to play** (stored as `finished` / `watching` / `want`). Three taps, as for everything else.
- **Without a RAWG key** game search is off: "All" leaves games out, the Games switch says "Search isn't working right now", and games already saved still show.

### The Play tab
- Collection tabs: **Watch · Read · Play** (then the Atlas, stage 4, [ADR 0059](../../decisions/0059-atlas.md)). Each has its own header, filters and rows. A collection of only games opens on Play.
- The header shows **Play time** and **Games finished** for the year chosen, with a hint: "Play time is the hours you gave for each game, or its average playtime on RAWG when you didn't."
- Rows show "187h played" (the player's hours) or "About 43h on average" (RAWG's), with the status stamp: Finished / Playing / Want to play.
- The edit sheet's link is "About this game".

### Finishing a game
- Finished (in quick add, or from the edit sheet) opens the celebration, on the **Cartridge** card: the key art on a cartridge's label, the title printed under it, FINISHED stamped on the corner, and the hours under the cartridge.
- **"Hours played"** is asked with the rating and review (optional; whole hours, 1–9,999).
  - The card shows it at once ("187 hours played").
  - Left empty, the card shows RAWG's average ("43 hours, on average"), or no number.
  - "Hide on card" can hide it ("Play time").
  - "Make a card" later brings the hours back to change them.
- Other styles: Ticket, Polaroid, Bold Stats (the art cropped into their portrait slots). Games have no Progress cards.
- In Thai the stamp says เล่นจบแล้ว, and the celebration says "เล่น … จบแล้ว!".

### How play time counts
- A finished game counts the player's hours, else RAWG's average, else nothing, **all on its finish date** (as a movie counts its runtime). A game still being played counts nothing yet.
- The Play tab's header, the stats page's play row, "Games" in Taste, weekly and monthly recaps ("hours played") and the Year in Review use the same numbers.
- Play time is **not** watch time. It isn't in the hours milestones (1,000 hours watched), the monthly "20 hours" challenge or the board. Game finishes count as titles finished everywhere: headline, milestones ("100th title"), challenges, badges.
- A recap card fits three figures: with watching, reading and playing and titles finished, the smallest time gives way.

### The game page (`/title/game/[id]`)
- The key art, taped into the album (a controller when RAWG has none), the name, "Game · year · genres", the platforms and "Average playtime: about 43h".
- Where the game stands: "Finished Sep 30, 2026 · 187h played", "Playing, on your Play shelf", or "Not in your collection yet" with **Add it to your collection** (quick add on this game's status step).
- Our own scene warnings, finishers and clubs, as on every title page.
- "Game data and art from RAWG", linked to the game on RAWG.

### Warnings
- DoesTheDogDie isn't asked about games.
- Our own **scene warnings** cover games: every topic, about the whole game (a game has no fixed timeline, so no time, episode or chapter). Adding and confirming need the game on the Play shelf as Playing or Finished, as for other titles. The warnings quiz asks about finished games too.

### Everywhere else
- **Badges:** Player One (a first game), Level Up (10 games). A game counts as a kind for All-Rounder ("4 kinds of title").
- **Clubs:** Gamers.
- **The Shelf** on public profiles shows a finished game as a game case: its art under a platform band.
- **Imports:** "Imported 12 games". Mystonie's CSV export carries `hours_played`; exports made before games still import.
- **Offline:** games are added and finished offline like everything else. Their art is kept on the device, and the hours travel with the notes.
- **Attribution:** "Game data and images from RAWG" (linked) in every page's footer, as RAWG's terms ask. The Privacy Policy and Terms name RAWG.

## Acceptance criteria
- [x] Searching finds games from RAWG, under Games and in All, labelled as games with their platforms, best known first. (`src/core/catalog/rawg.test.ts` with RAWG's own game objects and its live answer for "zelda"; `catalogs.test.ts` for the merge; `e2e/games.spec.ts`; checked live with the key on 2026-09-30)
- [x] A game is added in three taps, as Finished, Playing or Want to play, and lands on the Play tab. (`e2e/games.spec.ts`)
- [x] Finishing a game celebrates on the Cartridge card, and the hours played given there show on the card and are saved. (`e2e/games.spec.ts`; `saved.test.ts`, `entries.test.ts`, `ops.test.ts`, `overlay.test.ts`)
- [x] The Play tab's header, the stats page, recaps and the Year in Review agree on play time, and play time stays out of watch time and the hours milestones. (`src/core/stats/play.test.ts`)
- [x] RAWG is credited, with a link, on every page and on the game page. (`e2e/games.spec.ts`)
- [x] Every card template fits a game's Finish card at both sizes, with a long title in Japanese. (`e2e/cards.spec.ts`)

## Data
- `titles.kind` takes `game`, `titles.source` takes `rawg`; new `titles.playtime_hours` (RAWG's average) and `titles.platforms` ([data model](../../architecture/data-model.md), migration `20261008090000_stage3_games.sql`).
- `entries.hours_played`: the player's hours for a game (1–9,999), written by the notes patch.
- `warning_topics.kinds` takes `game` (every topic has it); the scene warning trigger refuses a place on a game's warning.
- `RAWG_API_KEY` (server only).

## Not in this task
- **HowLongToBeat** times (main story, completionist): only if HowLongToBeat grants permission or a data license. There's no official API, and the owner ruled out scraping ([ADR 0044](../../decisions/0044-games-rawg.md)).
- Logging play sessions or hours as you go; Progress cards for games.
- Which platform the player played on.
- Importing from Steam, Backloggd, PlayStation or Xbox.
- DoesTheDogDie warnings for games.
