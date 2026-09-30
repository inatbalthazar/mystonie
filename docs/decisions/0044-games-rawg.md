# ADR 0044: Games from RAWG: a fifth catalog, landscape art, the player's own hours, no HowLongToBeat

**Status:** Accepted · **Date:** 2026-09-30 · Supersedes [ADR 0005](0005-hltb-via-edge-function-cache.md)

## Context
The last stage 3 task is "Games (RAWG, + HowLongToBeat if the owner approves it)" ([S3 games](../product/features/S3-games.md)). The owner task before it (a RAWG key, its terms, a decision on HowLongToBeat) isn't done yet. [ADR 0005](0005-hltb-via-edge-function-cache.md) had planned RAWG for game data and a cached server job scraping HowLongToBeat (HLTB), with RAWG's average playtime as the fallback.

What we found (checked 2026-09-30):
- **RAWG's API** needs a `key` on every call (401 without). The free plan allows 20,000 requests a month.
- **RAWG's terms don't agree with each other on commercial use.** The pricing on rawg.io/apidocs says the free plan is for non-commercial projects, and commercial use starts at the $149/month Business plan. The terms in the API's own OpenAPI description say it's free for commercial use by projects under 100,000 monthly active users or 500,000 page views a month. Both ask us to name RAWG as the source of the data and images, with an active link from every page that uses them. No cloning RAWG, no passing its data on.
- **IGDB** (Twitch) is free for non-commercial use only; commercial use needs a partnership. It also needs a Twitch app and OAuth tokens.
- **RAWG's art** is `background_image`: landscape key art, 1920 × 1080, on `media.rawg.io`, served with `Access-Control-Allow-Origin: *`.
  - Ready-made copies exist at widths 80, 200, 420, 640, 1280 and 1920 (`/media/resize/{w}/-/…`), plus `crop/600/400`.
  - Any other size redirects to a slow resize on the API host.
  - There are no portrait covers.
- **RAWG's `playtime`** is an average in hours. It is often 0 for console-only games.
- **HowLongToBeat** has no official API.

## Decision
**RAWG is the fifth catalog.**
- Games are titles of kind `game` from source `rawg`, with RAWG's numeric ids.
- `TITLE_KINDS` / `isTitleKind` in `src/core/catalog/types.ts` replace the kind lists that were written out in several places.
- `src/core/catalog/rawg.ts` normalizes `/games?search=` and `/games/{id}`.
  - Search asks for close matches without DLC (`search_precise`, `exclude_additions`) and 20 results.
  - Adults-only games are left out (ESRB "AO", RAWG's `nsfw` and `hentai` tags), as adult titles are on AniList and Google Books.
  - Platforms come from `parent_platforms`, named briefly ("PC", "PlayStation", "Xbox", "Nintendo", "Mac", …).
- `src/data/rawg.ts` keeps the key on the server (`RAWG_API_KEY`).
  - Without a key, game search answers 503, "All" leaves games out, and games already saved still show.
  - Answers stay a day in Next's fetch cache (queries are lower-cased), and titles stay 7 days in `titles`, as for the other catalogs ([ADR 0012](0012-catalog-api-caching-and-limits.md)).
- **The request budget:** "All" asks RAWG from 3 characters; the Games switch from 2, as every catalog.
  - At about three debounced searches per title added, the free 20,000 requests cover roughly 6,000 additions a month.
  - Rejected: a global daily cap now. The rate-limit counter would count Next's cache hits as calls, and pre-launch traffic is far below the quota.
- Rejected: IGDB. The roadmap names RAWG, its commercial terms are no better, and its Twitch OAuth adds a token to refresh.

**Game art stays landscape.**
- `titles.poster_path` holds RAWG's media path (`games/618/618c….jpg`). `posterUrl` picks a ready-made width: 420 for lists, 640 for pages, 1280 for big sizes.
- Portrait slots (search results, collection rows and tiles, the Polaroid, the Ticket) crop the middle of the art (`object-cover`).
- The game page and the quick-add status step show it landscape. The new Cartridge card is drawn around it.
- Cards draw the 1280 copy (`cardImageUrl`).
- `isCardPosterUrl` allows RAWG's host at its ready-made sizes only, so a card link can't show an arbitrary picture.
- No proxy is needed (CORS is open), and the service worker keeps the art for offline use like other posters.
- Rejected: a portrait crop URL (`crop/400/600` isn't ready-made, so each one is a slow redirect).
- Rejected: landscape rows everywhere. Every list and card would need a second layout.

**Play time: the player's own hours, else RAWG's average.**
- `titles.playtime_hours` keeps RAWG's average (null for 0), and `titles.platforms` the platform names.
- `entries.hours_played` is the player's own count: whole hours, 1–9,999, optional.
  - The celebration asks it with the rating and review ("Celebrate first, ask later"), and the card shows it at once.
  - It travels on the notes patch and the `entry.notes` op, so it works offline and the later edit wins as for ratings ([ADR 0042](0042-offline-first.md)).
- `titlePlay` (`src/core/stats/play.ts`): a finished game counts the player's hours, else the average, all on its finish date, as a movie counts its runtime. It feeds the Play tab's header and rows, a play row on the stats page, "Games" in Taste, the recaps' `playMinutes` ("hours played") and the Year in Review, so they agree.
- Play time stays out of watch time, the hours milestones, the monthly hours challenge and the board. A 60-hour game finished on a Sunday would swamp a week of watching, and the average is a guess.
- Rejected: counting only the player's hours. Many console games have no RAWG average and many people won't type hours, so most finishes would add nothing.
- Rejected: play sessions (logging hours as you go), like reading logs. That's another table and another flow. Games have no episodes or pages to tick off, and the total at the end is what people share.

**Collection and pages.**
- Games get a **Play** tab. Status words are Playing / Want to play (stored as `watching` / `want`).
- Games are added and finished from the collection, as movies are.
- The game page (`/title/game/[id]`) shows:
  - the art, year, genres, platforms and average playtime;
  - where the game stands on the Play shelf;
  - our own scene warnings, finishers and clubs;
  - RAWG's credit.

  For a game not in the collection yet, it links to quick add on that game's status step (`?add=1&pick=game:<id>`).
- RAWG is credited in every page's footer ("Game data and images from RAWG", linked), and on the game page with a link to the game on RAWG.

**Cards: Finish cards only, with a Cartridge.**
- Games have no Progress cards (there's no progress to log).
- Finish cards come on the Ticket, Polaroid and Bold Stats, and on a new **Cartridge**, which a game's card opens on. The Cartridge puts the key art on a cartridge label taped into the album, and the art takes whatever height the notes leave.
- The stamp says "Finished" (Thai: เล่นจบแล้ว).
- The number is the hours played, or "hours, on average" with RAWG's figure. "Hide on card" can hide it.
- `titleSizeStep` now counts a wide CJK character as two letters. A long Japanese name overflowed the Sticker; titles of 8 or more CJK characters are one size smaller everywhere.

**Warnings.**
- DoesTheDogDie isn't asked about games: our DTDD lookups match TMDB titles.
- Our own scene warnings cover games. Every topic applies (jump scares, flashing lights and loud noises most of all). A game's warning is about the whole game: the insert trigger refuses a season, a time or a chapter.

**HowLongToBeat: not built.** It has no official API. Scraping it needs the owner's approval: its terms are a risk, and a scraper needs watching. The player's own hours and RAWG's average cover the need until then. The owner's call on 2026-09-30: no scraper (including `ckatzorke/howlongtobeat`); ask HowLongToBeat for permission or a data license instead, and add its times only if they agree.

**Small things that come with a new kind:**
- badges "Player One" (a first game) and "Level Up" (10 games);
- a "Gamers" club;
- a game case on the Shelf;
- "game" as an import unit ("Imported 12 games");
- the CSV export's `hours_played` column (files exported before games still import);
- the account export's `hours_played`.

## Consequences
- The remote project needs `20261008090000_stage3_games.sql` (when the owner says so), and Vercel needs `RAWG_API_KEY` (Sensitive). Until then, game search answers 503 and "All" has no games.
- **Commercial use of RAWG** needs the owner's reading of the terms, or RAWG's answer (api@rawg.io), before Pro takes money, as DTDD's Commercial tier does ([open questions](../open-questions.md) O7).
- The normalizer's fixtures were built from RAWG's own page data (the same game objects its API serves), because there was no key yet. Once the key is in, one live search (`/api/search?type=game&q=witcher`) confirms the shape.
- If requests near 20,000 a month, the options are: cache searches in Postgres, raise the "All" threshold, or pay for a plan.
- If HowLongToBeat grants permission or a data license later, a new ADR adds a cached job that fills main-story and completionist times next to RAWG's average.
