import { describe, expect, it } from "vitest";
import movie from "./fixtures/tmdb-movie-496243.json";
import search from "./fixtures/tmdb-search-multi.json";
import tv from "./fixtures/tmdb-tv-66732.json";
import { mergeTmdbSearch, normalizeTmdbDetails, normalizeTmdbList, tmdbImageUrl, tmdbMediaType } from "./tmdb";

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
