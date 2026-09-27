import { describe, expect, it } from "vitest";
import movie from "./fixtures/tmdb-movie-496243.json";
import search from "./fixtures/tmdb-search-multi.json";
import tv from "./fixtures/tmdb-tv-66732.json";
import {
  mergeTmdbSearch,
  normalizeTmdbDetails,
  normalizeTmdbList,
  normalizeTmdbSeason,
  tmdbImageUrl,
  tmdbMediaType,
  tmdbSeasonNumbers,
  tmdbSeriesEnded,
} from "./tmdb";

describe("normalizeTmdbList", () => {
  const results = normalizeTmdbList(search);

  it("keeps movies and series only, dropping people, adult and nameless items", () => {
    expect(results.map((r) => [r.kind, r.externalId])).toEqual([
      ["series", "66732"],
      ["movie", "1068115"],
      ["series", "96162"],
    ]);
  });

  it("maps a series with poster and year", () => {
    expect(results[0]).toEqual({
      source: "tmdb",
      externalId: "66732",
      kind: "series",
      name: "Stranger Things",
      originalLanguage: "en",
      year: 2016,
      imageUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
    });
  });

  it("omits missing poster and empty release dates", () => {
    expect(results[1]).not.toHaveProperty("imageUrl");
    expect(results[1]).not.toHaveProperty("year");
  });

  it("keeps the original name only when it differs", () => {
    expect(results[0]).not.toHaveProperty("originalName");
    expect(results[2]!.originalName).toBe("비밀의 숲");
  });

  it("returns [] for junk input", () => {
    expect(normalizeTmdbList(null)).toEqual([]);
    expect(normalizeTmdbList({ results: "nope" })).toEqual([]);
    expect(normalizeTmdbList({ status_code: 7, status_message: "Invalid API key" })).toEqual([]);
  });
});

describe("mergeTmdbSearch", () => {
  const movies = { results: [
    { id: 1, title: "Doctor Strange", release_date: "2016-10-25", popularity: 40 },
    { id: 2, title: "Strange Days", release_date: "1995-10-13", popularity: 5 },
  ] };
  const tv = { results: [
    { id: 66732, name: "Stranger Things", first_air_date: "2016-07-15", popularity: 300 },
    { id: 3, name: "Strange Angel", popularity: 1 },
  ] };

  it("tags kinds from the endpoint and sorts both lists by popularity", () => {
    expect(mergeTmdbSearch(movies, tv).map((r) => `${r.kind}:${r.name}`)).toEqual([
      "series:Stranger Things",
      "movie:Doctor Strange",
      "movie:Strange Days",
      "series:Strange Angel",
    ]);
  });

  it("caps the list and survives one failed side", () => {
    expect(mergeTmdbSearch(movies, tv, 2)).toHaveLength(2);
    expect(mergeTmdbSearch(null, tv).map((r) => r.name)).toEqual(["Stranger Things", "Strange Angel"]);
  });
});

describe("normalizeTmdbDetails", () => {
  it("maps a series, using the last episode runtime when episode_run_time is empty", () => {
    expect(normalizeTmdbDetails("series", tv)).toEqual({
      source: "tmdb",
      externalId: "66732",
      kind: "series",
      name: "Stranger Things",
      originalName: "Stranger Things",
      originalLanguage: "en",
      year: 2016,
      posterPath: "/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg",
      genres: ["Drama", "Sci-Fi & Fantasy", "Mystery"],
      runtimeMin: 128,
      episodeCount: 42,
      seasonCount: 5,
      pageCount: null,
      chapterCount: null,
      volumeCount: null,
    });
  });

  it("maps a movie with a non-Latin original title", () => {
    expect(normalizeTmdbDetails("movie", movie)).toMatchObject({
      kind: "movie",
      name: "Parasite",
      originalName: "기생충",
      year: 2019,
      runtimeMin: 133,
      episodeCount: null,
      seasonCount: null,
    });
  });

  it("treats runtime 0 as unknown", () => {
    expect(normalizeTmdbDetails("movie", { ...movie, runtime: 0 })!.runtimeMin).toBeNull();
  });

  it("returns null without an id or name", () => {
    expect(normalizeTmdbDetails("movie", { title: "No id" })).toBeNull();
    expect(normalizeTmdbDetails("series", { id: 1 })).toBeNull();
  });
});

describe("helpers", () => {
  it("builds sized image URLs and TMDB media types", () => {
    expect(tmdbImageUrl("/a.jpg", "w780")).toBe("https://image.tmdb.org/t/p/w780/a.jpg");
    expect(tmdbMediaType("series")).toBe("tv");
    expect(tmdbMediaType("movie")).toBe("movie");
  });
});

describe("seasons", () => {
  it("normalizes a season's episodes", async () => {
    const season = (await import("./fixtures/tmdb-tv-66732-season-1.json")).default;
    const episodes = normalizeTmdbSeason(season);
    expect(episodes).toHaveLength(8);
    expect(episodes[0]).toEqual({
      season: 1,
      episode: 1,
      name: "Chapter One: The Vanishing of Will Byers",
      runtimeMin: 48,
      airDate: "2016-07-15",
    });
  });

  it("drops episodes from other seasons and bad dates", () => {
    expect(
      normalizeTmdbSeason({
        season_number: 2,
        episodes: [
          { season_number: 2, episode_number: 2, name: "", runtime: 0, air_date: "soon" },
          { season_number: 1, episode_number: 1 },
          { season_number: 2, episode_number: 1, runtime: 45, air_date: "2026-01-01" },
        ],
      }),
    ).toEqual([
      { season: 2, episode: 1, name: null, runtimeMin: 45, airDate: "2026-01-01" },
      { season: 2, episode: 2, name: null, runtimeMin: null, airDate: null },
    ]);
    expect(normalizeTmdbSeason({ season_number: 0, episodes: [] })).toEqual([]);
  });

  it("lists numbered seasons with episodes, and whether the series ended", () => {
    const details = {
      status: "Ended",
      seasons: [
        { season_number: 0, episode_count: 3 },
        { season_number: 2, episode_count: 9 },
        { season_number: 1, episode_count: 8 },
        { season_number: 3, episode_count: 0 },
      ],
    };
    expect(tmdbSeasonNumbers(details)).toEqual([1, 2]);
    expect(tmdbSeriesEnded(details)).toBe(true);
    expect(tmdbSeriesEnded({ status: "Returning Series" })).toBe(false);
    expect(tmdbSeasonNumbers(null)).toEqual([]);
  });
});
