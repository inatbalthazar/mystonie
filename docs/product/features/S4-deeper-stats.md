# S4 · Deeper stats: favourite actor, director and studio

**Stage:** 4 (owner ideas, 2026-09-30) · **Built** 2026-09-30 ([ADR 0047](../../decisions/0047-title-credits.md))

## Summary
Stats get personal: who you keep watching. The stats page and Year in Review show your favourite actors, directors, studios, authors and game developers, with photos, and the stats and Year in Review cards name the top ones.

## Behaviour
- **Where the people come from** (kept with each title as `titles.credits`, no extra calls):
  - Movies and series (TMDB, `append_to_response=credits` on the details call we already make): the top-billed cast (5, by billing order), the directors (a series' creators, since series have no single director) and the production companies (studios, 3).
  - Books (Google Books): the authors. Manga (AniList): the staff who wrote or drew it ("Story & Art", "Story", "Art"). Games (RAWG): the developers.
- **Counting:** over the titles **finished** in the selected period (this week, month, year, all time), by number of titles, then by the time those titles took (watch, read or play time in the period), then by name. A person listed twice on one title counts once. Top 5 of each.
- **Stats page:** a "Favourites" section after Taste: Actors, Directors & creators, Studios, Authors, Developers (each only when it has someone), with a round photo (a studio's logo on a white chip, initials when there is no picture), "3 titles · 6h 20m". Hidden while no finished title has credits. Year in Review shows the same section for its year.
- **Cards:** a stats card (Share stats, Share my collection) says "Favourite actor Song Kang-ho · Favourite director Bong Joon Ho" under its titles; the Year in Review card adds them to its standouts (the first after the top genre, the second on the story size). A favourite goes on a card only from **2 finished titles**: with one, it's just whoever was in the one film. At most 2, in the order actor, director, author, developer, studio.
- **Existing titles:** the next refresh of a title fetches its credits (picked in search after its 7-day cache, or a series' daily episode refresh). The one-off backfill fills the rest: `POST /api/admin/backfill-credits` (bearer `ADMIN_SECRET`, `{ "limit": 1–50 }` → `{ fromCache, fetched, failed, remaining }`), run until `remaining` is 0. Books and games already have their people in the cached body (no call); movies, series and manga are fetched again, 4 at a time (TMDB allows ~50 a second, AniList ~30 a minute). A title the catalog no longer knows gets no credits; a failure goes to the back of the queue.
- **Images:** TMDB profile photos and logos at `w185` from `image.tmdb.org`, AniList staff images as given (only those two hosts, checked in `creditImageUrl`), loaded straight from them like the posters (TMDB's notice is on every page; the privacy policy names both). RAWG has no developer logos, Google Books no author photos.

## Acceptance criteria
- [x] Credits are cached with each title without an extra catalog call. (`src/core/catalog/credits.test.ts`)
- [x] Top 5 per role over finished titles, by titles then hours. (`src/core/stats/report.test.ts`)
- [x] The stats page and Year in Review show them with photos; the stats and Year in Review cards name the favourites. (`e2e/stats.spec.ts`, `/card-lab` fixtures `stats-all-time` and `year-review`)
- [x] Existing titles can be backfilled within the catalogs' rate limits. (checked locally: 267 cached titles in 6 runs)

## Data
`titles.credits jsonb` (null until fetched; an array of ≤ 20 `{ role, id, name, image }`), migration `20261009090000_stage4_title_credits.sql`. **It must be applied to the remote project before this code is deployed**: the stats rows select the column. Saved cards keep `recap.favourites` (`[{ role, name }]`, ≤ 2) in `cards.params`.
