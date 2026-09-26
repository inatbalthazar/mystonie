# ADR 0001: TMDB instead of IMDb for movie/TV data

**Status:** Accepted · **Date:** 2026-09-23

## Context
The original spec asks for IMDb-style instant search and "all data from IMDb". IMDb has no free public API: its official data is licensed (paid, via AWS Data Exchange) and scraping it violates its terms. The same spec already names TMDB as the movie/TV data source.

## Decision
Use **TMDB** for movie and TV search, details, runtimes, episodes, posters and genres, and TMDB's watch-provider endpoint (JustWatch data) for "where to watch". Keep `imdb_id` (TMDB provides it) on `titles.raw` for cross-referencing and Letterboxd/IMDb imports.

## Consequences
- Free, fast instant search with posters. Requires TMDB (and JustWatch) attribution in the UI.
- Ratings shown are TMDB's, not IMDb's.
