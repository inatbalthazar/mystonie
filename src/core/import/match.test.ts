import { describe, expect, it } from "vitest";
import type { SearchResult } from "../catalog/types";
import { matchAnime, matchBook, matchFilm, matchShow, normalizeTitle, withoutSeason, type MovieSearch } from "./match";

const movie = (externalId: string, name: string, year?: number, originalName?: string): SearchResult => ({
  source: "tmdb",
  externalId,
  kind: "movie",
  name,
  ...(originalName ? { originalName } : {}),
  ...(year !== undefined ? { year } : {}),
});

/** A fake TMDB search: answers from a table keyed `"query|year"` and records every call. */
function fakeSearch(table: Record<string, SearchResult[]>): MovieSearch & { calls: string[] } {
  const calls: string[] = [];
  const search = async (query: string, year: number | null) => {
    const key = `${query}|${year ?? ""}`;
    calls.push(key);
    return table[key] ?? [];
  };
  return Object.assign(search, { calls });
}

describe("normalizeTitle", () => {
  it("ignores case, accents, punctuation, '&' vs 'and' and spacing", () => {
    expect(normalizeTitle("Amélie")).toBe("amelie");
    expect(normalizeTitle("Spider-Man: Into the Spider-Verse")).toBe("spider man into the spider verse");
    expect(normalizeTitle("Fast & Furious")).toBe(normalizeTitle("Fast and Furious"));
    expect(normalizeTitle("WALL·E")).toBe("wall e");
    expect(normalizeTitle("  기생충 ")).toBe("기생충");
  });
});

describe("matchFilm", () => {
  it("matches the same name and year with one search", async () => {
    const search = fakeSearch({ "Dune|2021": [movie("438631", "Dune", 2021)] });
    expect(await matchFilm({ name: "Dune", year: 2021 }, search)).toEqual({ state: "matched", match: movie("438631", "Dune", 2021) });
    expect(search.calls).toEqual(["Dune|2021"]);
  });

  it("tells a remake from the original by year", async () => {
    const search = fakeSearch({ "Suspiria|1977": [movie("11906", "Suspiria", 1977), movie("361292", "Suspiria", 2018)] });
    const result = await matchFilm({ name: "Suspiria", year: 1977 }, search);
    expect(result).toMatchObject({ state: "matched", match: { externalId: "11906" } });
  });

  it("matches on the original name", async () => {
    const search = fakeSearch({ "Amelie|2001": [movie("194", "Amélie", 2001, "Le Fabuleux Destin d'Amélie Poulain")] });
    const byOriginal = fakeSearch({
      "Le Fabuleux Destin d’Amélie Poulain|2001": [movie("194", "Amélie", 2001, "Le Fabuleux Destin d'Amélie Poulain")],
    });
    expect(await matchFilm({ name: "Le Fabuleux Destin d’Amélie Poulain", year: 2001 }, byOriginal)).toMatchObject({
      state: "matched",
      match: { externalId: "194" },
    });
    expect(await matchFilm({ name: "Amelie", year: 2001 }, search)).toMatchObject({ state: "matched" });
  });

  it("absorbs a year of release-date drift with a second search", async () => {
    const lady = movie("531428", "Portrait of a Lady on Fire", 2019);
    const search = fakeSearch({ "Portrait of a Lady on Fire|": [lady] });
    expect(await matchFilm({ name: "Portrait of a Lady on Fire", year: 2020 }, search)).toEqual({ state: "matched", match: lady });
    expect(search.calls).toEqual(["Portrait of a Lady on Fire|2020", "Portrait of a Lady on Fire|"]);
  });

  it("takes the only film of that year under another name", async () => {
    const birdman = movie("194662", "Birdman or (The Unexpected Virtue of Ignorance)", 2014);
    const search = fakeSearch({ "Birdman|2014": [birdman] });
    expect(await matchFilm({ name: "Birdman", year: 2014 }, search)).toEqual({ state: "matched", match: birdman });
  });

  it("asks when two films share the name and year", async () => {
    const twins = [movie("1", "Twin", 2020), movie("2", "Twin", 2020)];
    const search = fakeSearch({ "Twin|2020": twins });
    expect(await matchFilm({ name: "Twin", year: 2020 }, search)).toEqual({ state: "ambiguous", candidates: twins });
  });

  it("takes the film everybody knows over an obscure namesake of the same year", async () => {
    const arrival = { ...movie("329865", "Arrival", 2016), votes: 19000 };
    const short = { ...movie("5", "Arrival", 2016), votes: 3 };
    expect(await matchFilm({ name: "Arrival", year: 2016 }, fakeSearch({ "Arrival|2016": [short, arrival] }))).toEqual({ state: "matched", match: arrival });
  });

  it("still asks when namesakes are both known, or neither is", async () => {
    const a = { ...movie("1", "Burning", 2018), votes: 3000 };
    const b = { ...movie("2", "Burning", 2018), votes: 400 };
    expect(await matchFilm({ name: "Burning", year: 2018 }, fakeSearch({ "Burning|2018": [a, b] }))).toMatchObject({ state: "ambiguous" });
    const c = { ...movie("3", "Runner", 2026), votes: 40 };
    const d = movie("4", "Runner", 2026);
    expect(await matchFilm({ name: "Runner", year: 2026 }, fakeSearch({ "Runner|2026": [c, d] }))).toMatchObject({ state: "ambiguous" });
  });

  it("offers what it found, without repeats, when nothing is certain", async () => {
    const search = fakeSearch({
      "Hero|2003": [movie("1", "Hero (Ying xiong)", 2002)],
      "Hero|": [movie("1", "Hero (Ying xiong)", 2002), movie("2", "Heroes", 2003), { ...movie("5", "Hero", 2003), kind: "series" }, movie("9", "Superhero", 2008)],
    });
    const result = await matchFilm({ name: "Hero", year: 2003 }, search);
    expect(result.state).toBe("ambiguous");
    expect(result.state === "ambiguous" && result.candidates.map((c) => c.externalId)).toEqual(["1", "2", "9"]);
  });

  it("is missing when TMDB finds nothing", async () => {
    const search = fakeSearch({});
    expect(await matchFilm({ name: "A Film Nobody Made", year: 1999 }, search)).toEqual({ state: "missing" });
    expect(search.calls).toHaveLength(2);
  });

  it("without a year, matches a unique name and asks between namesakes, in one search", async () => {
    const heat = fakeSearch({ "Heat|": [movie("949", "Heat", 1995), movie("7", "Heat Wave", 2010)] });
    expect(await matchFilm({ name: "Heat", year: null }, heat)).toMatchObject({ state: "matched", match: { externalId: "949" } });
    expect(heat.calls).toEqual(["Heat|"]);
    const crash = fakeSearch({ "Crash|": [movie("1640", "Crash", 2004), movie("884", "Crash", 1996)] });
    expect(await matchFilm({ name: "Crash", year: null }, crash)).toMatchObject({ state: "ambiguous" });
    expect(crash.calls).toEqual(["Crash|"]);
  });
});

const series = (externalId: string, name: string, year?: number, originalName?: string, votes?: number): SearchResult => ({
  ...movie(externalId, name, year, originalName),
  kind: "series",
  ...(votes !== undefined ? { votes } : {}),
});

describe("matchShow", () => {
  it("trusts TheTVDB's id when TMDB's series under it has the name", async () => {
    const office = series("2316", "The Office", 2005);
    const search = fakeSearch({});
    expect(await matchShow({ name: "The Office", year: null, tvdbId: "73244" }, search, async () => [office])).toEqual({ state: "matched", match: office });
    expect(search.calls).toEqual([]);
  });

  it("searches by name when the id finds nothing (or something else), and tells namesakes apart", async () => {
    const us = series("2316", "The Office", 2005, undefined, 3000);
    const uk = series("2996", "The Office", 2001, undefined, 1200);
    const search = fakeSearch({ "The Office|": [us, uk, series("9", "The Office Mix", 2020)] });
    expect(await matchShow({ name: "The Office", year: null, tvdbId: "1" }, search, async () => [series("5", "Something Else")])).toMatchObject({
      state: "ambiguous",
      candidates: [us, uk],
    });
    const who = series("57243", "Doctor Who", 2005);
    const byYear = fakeSearch({ "Doctor Who|2005": [who] });
    expect(await matchShow({ name: "Doctor Who", year: 2005, tvdbId: null }, byYear, async () => [])).toEqual({ state: "matched", match: who });
  });
});

describe("matchBook", () => {
  const book = (externalId: string, name: string, creator?: string): SearchResult => ({
    source: "google_books",
    externalId,
    kind: "book",
    name,
    ...(creator ? { creator } : {}),
  });
  const books = (table: Record<string, SearchResult[]>) => {
    const calls: string[] = [];
    return Object.assign(
      async (q: string) => {
        calls.push(q);
        return table[q] ?? [];
      },
      { calls },
    );
  };

  it("takes the book its ISBN names", async () => {
    const dune = book("B1rCgAAAQBAJ", "Dune", "Frank Herbert");
    const search = books({ "isbn:9780441172719": [dune] });
    expect(await matchBook({ name: "Dune", author: "Frank Herbert", isbn: "9780441172719" }, search)).toEqual({ state: "matched", match: dune });
    expect(search.calls).toEqual(["isbn:9780441172719"]);
  });

  it("falls back to title and author, where editions of one book by one author are the same book", async () => {
    const a = book("aaaaaaaaaaaa", "Piranesi", "Susanna Clarke");
    const b = book("bbbbbbbbbbbb", "Piranesi: A Novel", "Susanna Clarke");
    const search = books({ 'intitle:"Piranesi" inauthor:"Clarke"': [a, b] });
    expect(await matchBook({ name: "Piranesi", author: "Susanna Clarke", isbn: "9781635575637" }, search)).toEqual({ state: "matched", match: a });
    expect(search.calls).toEqual(["isbn:9781635575637", 'intitle:"Piranesi" inauthor:"Clarke"']);
  });

  it("asks when authors differ or nothing has the title, and is missing when nothing is found", async () => {
    const x = book("xxxxxxxxxxxx", "Emma", "Jane Austen");
    const y = book("yyyyyyyyyyyy", "Emma", "Someone Else");
    expect(await matchBook({ name: "Emma", author: null, isbn: null }, books({ 'intitle:"Emma"': [x, y] }))).toMatchObject({ state: "ambiguous", candidates: [x, y] });
    const other = book("zzzzzzzzzzzz", "A Study Guide", "Jane Austen");
    expect(await matchBook({ name: "Emma", author: "Jane Austen", isbn: null }, books({ 'intitle:"Emma" inauthor:"Austen"': [other] }))).toMatchObject({
      state: "ambiguous",
    });
    expect(await matchBook({ name: "Nothing", author: null, isbn: null }, books({}))).toEqual({ state: "missing" });
  });
});

describe("matchAnime", () => {
  it("drops a sequel's season marker and its year, and finds the series by its Japanese original name too", async () => {
    expect(withoutSeason("Attack on Titan Season 2")).toBe("Attack on Titan");
    expect(withoutSeason("Shingeki no Kyojin: The Final Season")).toBe("Shingeki no Kyojin");
    expect(withoutSeason("Kimetsu no Yaiba 2nd Season")).toBe("Kimetsu no Yaiba");
    expect(withoutSeason("進撃の巨人 第2期")).toBe("進撃の巨人");
    expect(withoutSeason("Mob Psycho 100 II")).toBe("Mob Psycho 100");
    expect(withoutSeason("Steins;Gate 0")).toBe("Steins;Gate 0");

    const aot = series("1429", "Attack on Titan", 2013, "進撃の巨人");
    const tv = fakeSearch({ "Attack on Titan|": [aot] });
    const result = await matchAnime(
      { format: "TV", names: ["Attack on Titan Season 2", "Shingeki no Kyojin Season 2", "進撃の巨人 Season2"], year: 2017 },
      { name: "Shingeki no Kyojin Season 2", find: "series" },
      { movies: fakeSearch({}), series: tv },
    );
    expect(result).toEqual({ state: "matched", match: aot });
    expect(tv.calls).toEqual(["Attack on Titan|"]);
  });

  it("finds films among movies, by year, and tries the romanized name when the English one finds nothing", async () => {
    const film = movie("129", "Spirited Away", 2001, "千と千尋の神隠し");
    const movies = fakeSearch({ "Sen to Chihiro no Kamikakushi|": [film] });
    const result = await matchAnime(
      { format: "MOVIE", names: ["Spirited Away", "Sen to Chihiro no Kamikakushi"], year: 2001 },
      { name: "Sen to Chihiro no Kamikakushi", find: "movie" },
      { movies, series: fakeSearch({}) },
    );
    expect(result).toMatchObject({ state: "matched", match: { externalId: "129" } });
    expect(movies.calls).toEqual(["Spirited Away|2001", "Spirited Away|", "Sen to Chihiro no Kamikakushi|2001", "Sen to Chihiro no Kamikakushi|"]);
  });

  it("uses MyAnimeList's own title when AniList doesn't know it", async () => {
    const bebop = series("30991", "Cowboy Bebop", 1998);
    const result = await matchAnime(null, { name: "Cowboy Bebop", find: "series" }, { movies: fakeSearch({}), series: fakeSearch({ "Cowboy Bebop|": [bebop] }) });
    expect(result).toEqual({ state: "matched", match: bebop });
  });
});
