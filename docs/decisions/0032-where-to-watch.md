# ADR 0032: Where to watch from one cached row per title, the country guessed once and saved

**Status:** Accepted · **Date:** 2026-09-29

## Context
The stage 2 task "Where to watch by country" ([S2 where to watch](../product/features/S2-where-to-watch.md)) shows which services carry a movie or series in the user's country. The data comes from TMDB's `/{movie|tv}/{id}/watch/providers`, which is powered by JustWatch and must credit it.

What the build found:
- One TMDB call returns **every country** at once: about 80–130 countries for a popular title, 30–60 KB.
- The API has **no per-service deep links**. Each country has one link, to TMDB's watch page, which holds JustWatch's links into each service. JustWatch's own API is for partners only.
- `profiles.country` already existed (stage 1, `^[A-Z]{2}$`, owner-updatable) but nothing set it.
- Email sign-up has no server step: the code is verified in the browser, so the server never sees the sign-up request's IP.
- Movies had no title page.

## Decision
**Cache: a `title_providers` table, one row per title, every country in a `providers` jsonb.**
- Rows are refreshed after 24 hours by the server (service role). A stale row is still shown when TMDB is down.
- A page reads only its country's slice (`providers -> 'TH'`).
- Stored in the normalized, capped shape (`stream` / `free` / `buy`, at most 8 services each), not TMDB's body. The size check is 256 KB.
- Rejected: a jsonb column on `titles` (the spec's first idea). `getCachedTitle` selects `*`, so every title read (quick add, the title page) would carry every country's services.
- Rejected: one row per (title, country). A refresh would rewrite about 100 rows. "No row for this country" would also mean either "nothing there" or "not fetched".
- Rejected: Next's fetch cache alone, as AniList uses. The spec and the external-API rule ask for Postgres, and the row survives deploys and cache purges.

**Groups:** TMDB's `flatrate` → **Stream**, `free` + `ads` → **Free**, `rent` + `buy` → **Rent or buy**. Rent and buy come from the same stores, so they share one group, which keeps the block short at 360px.

**Links:** every logo opens TMDB's watch page for that title and country, where JustWatch's deep links into each service are. We don't build our own links into services: we have no source for them, and guessed search URLs break.

**Attribution:** "Streaming data from JustWatch" (linked) appears inside the block, next to the logos, in every state. The site footer already credits TMDB.

**Country:**
- The profile's `country` decides which country is shown.
- If it isn't set, it is guessed the first time a title page needs it: Vercel's `x-vercel-ip-country`, else the first region in `Accept-Language`. The guess is saved to the profile, and only if the profile has no country yet.
- It is changed from the block itself or from Settings → Preferences → Country. The choices are all 250 ISO 3166-1 codes (plus Kosovo), named by `Intl.DisplayNames` in the viewer's language on the server.
- Rejected: setting it at sign-up. Email sign-up never reaches our server, and existing accounts need the fallback anyway.
- This only concerns data. The UI language still comes from the URL and the saved setting ([ADR 0007](0007-english-first-global.md)): a Thai browser still gets English pages.

**Movie page:** `/title/movie/[id]` now exists as a small page: the header and Where to watch. The collection sheet links to it ("Where to watch") as it links series and books to theirs.

**Rendering:** the block is a server component inside `Suspense`. A TMDB call never holds up the series episodes or the header.

## Consequences
- The remote project needs `20260929090000_stage2_where_to_watch.sql` (after the earlier stage 2 migrations).
- TMDB use grows by at most one call per title per day, and only when someone opens that title page.
- TMDB's commercial terms (stage 2 owner task) cover this data too.
- Users who travel keep their saved country until they change it. That is deliberate: the setting is stable.
- Affiliate links stay later ([later/affiliate-links.md](../product/later/affiliate-links.md)).
