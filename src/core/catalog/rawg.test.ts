import { describe, expect, it } from "vitest";
import witcher from "./fixtures/rawg-game-3328.json";
import witcherSearch from "./fixtures/rawg-search-witcher.json";
import zeldaSearch from "./fixtures/rawg-search-zelda.json";
import { cardImageUrl, isCardPosterUrl, posterUrl, rawgMediaPath } from "./images";
import { normalizeRawgDetails, normalizeRawgSearch, RAWG_ALL_RESULTS, RAWG_RESULTS, rawgSearchParams } from "./rawg";
import { mergeSearch } from "./search";
import { isExternalId, isTitleKind, sourceForKind, type SearchResult } from "./types";

// Fixtures: RAWG's own game objects (from its website's page data, the same objects its API serves), trimmed; the
// platform lists are in the API's shape, `[{ platform: { id, name, slug } }]`. `rawg-search-zelda.json` is the API's
// live answer to the app's own search for "zelda" (2026-09-30), trimmed to the fields the normalizer reads.

const ART = "games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg";

describe("RAWG details", () => {
  it("maps a game to the titles row: key art path, genres, platforms and the average playtime", () => {
    expect(normalizeRawgDetails(witcher)).toEqual({
      source: "rawg",
      externalId: "3328",
      kind: "game",
      name: "The Witcher 3: Wild Hunt",
      originalName: null,
      originalLanguage: null,
      year: 2015,
      posterPath: ART,
      genres: ["Action", "RPG"],
      runtimeMin: null,
      episodeCount: null,
      seasonCount: null,
      pageCount: null,
      chapterCount: null,
      volumeCount: null,
      playtimeHours: 43,
      platforms: ["PC", "PlayStation", "Xbox", "Mac", "Nintendo"],
    });
  });

  it("keeps an original name that differs, and drops what can't be trusted", () => {
    expect(normalizeRawgDetails({ ...witcher, name_original: "Wiedźmin 3: Dziki Gon" })?.originalName).toBe("Wiedźmin 3: Dziki Gon");
    // RAWG says 0 when it doesn't know the playtime; a date it can't give is TBA.
    expect(normalizeRawgDetails({ ...witcher, playtime: 0, tba: true })).toMatchObject({ playtimeHours: null, year: null });
    expect(normalizeRawgDetails({ ...witcher, released: "someday" })?.year).toBeNull();
    // Art from anywhere but RAWG's media host is left out.
    expect(normalizeRawgDetails({ ...witcher, background_image: "https://evil.example/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg" })?.posterPath).toBeNull();
    expect(normalizeRawgDetails({ ...witcher, id: "3328" })).toBeNull();
    expect(normalizeRawgDetails({ ...witcher, name: " " })).toBeNull();
    expect(normalizeRawgDetails(null)).toBeNull();
  });

  it("leaves adult games out, by RAWG's tags", () => {
    expect(normalizeRawgDetails({ ...witcher, tags: [...witcher.tags, { id: 50, name: "NSFW", slug: "nsfw" }] })).toBeNull();
    expect(normalizeRawgDetails({ ...witcher, tags: [{ id: 51, name: "Hentai", slug: "hentai" }] })).toBeNull();
    // Mature games stay: The Witcher 3 is rated M. RAWG's ESRB field isn't trusted: it calls Hitman (2016) "Adults Only".
    expect(normalizeRawgDetails(witcher)).not.toBeNull();
    expect(normalizeRawgDetails({ ...witcher, esrb_rating: { id: 5, name: "Adults Only", slug: "adults-only" } })).not.toBeNull();
  });

  it("reads platforms as the API sends them, and as plain slugs", () => {
    expect(normalizeRawgDetails({ ...witcher, parent_platforms: ["pc", "playstation", "sega"] })?.platforms).toEqual(["PC", "PlayStation"]);
    const sega = [{ platform: { id: 11, name: "SEGA", slug: "sega" } }];
    expect(normalizeRawgDetails({ ...witcher, parent_platforms: sega })?.platforms).toEqual(["SEGA"]);
  });
});

describe("RAWG search", () => {
  it("lists games best known first, each labelled a game with its platforms and small art", () => {
    const results = normalizeRawgSearch(witcherSearch, "witcher");
    expect(results.map((r) => r.name)).toEqual([
      "The Witcher 3: Wild Hunt",
      "The Witcher 2: Assassins of Kings Enhanced Edition",
      "The Witcher: Enhanced Edition Director's Cut",
      "Gwent: The Witcher Card Game",
      "Dominion: Storm over Gift 3",
    ]);
    expect(results[0]).toEqual({
      source: "rawg",
      externalId: "3328",
      kind: "game",
      name: "The Witcher 3: Wild Hunt",
      year: 2015,
      imageUrl: `https://media.rawg.io/media/resize/420/-/${ART}`,
      platforms: ["PC", "PlayStation", "Xbox", "Mac", "Nintendo"],
    });
    // A screenshot as the art (its file name has a suffix).
    expect(results[4]!.imageUrl).toBe("https://media.rawg.io/media/resize/420/-/screenshots/756/7561352801d372b85c7e85320c3af43b_WLtB7U1.jpg");
  });

  it("drops duplicates and unusable items, and reads nothing from a bad body", () => {
    const [first] = witcherSearch.results;
    expect(normalizeRawgSearch({ results: [first, first, { id: 1 }, null] }, "witcher")).toHaveLength(1);
    expect(normalizeRawgSearch({ error: "The key parameter is not provided" }, "witcher")).toEqual([]);
    expect(normalizeRawgSearch(null, "witcher")).toEqual([]);
  });

  it("puts famous games first: RAWG's own order had Breath of the Wild 30th for \"zelda\"", () => {
    expect(zeldaSearch.results.findIndex((g) => g.id === 22511)).toBe(29);
    const results = normalizeRawgSearch(zeldaSearch, "zelda");
    expect(results).toHaveLength(RAWG_RESULTS);
    expect(results.slice(0, 3).map((r) => r.name)).toEqual([
      "The Legend of Zelda: Breath of the Wild",
      "The Legend of Zelda: Ocarina of Time (1998)",
      "The Legend of Zelda: Tears of the Kingdom",
    ]);
    // "All" merges only the best known, so a fan game called just "Zelda" can't take the top spot as an exact name.
    const all = mergeSearch("zelda", [results.slice(0, RAWG_ALL_RESULTS)]);
    expect(all[0]!.name).toBe("The Legend of Zelda: Breath of the Wild");
    expect(all.map((r) => r.name)).not.toContain("Zelda");
  });

  it("ranks names with every word first, the last word maybe half typed", () => {
    const g = (id: number, name: string, added: number) => ({ id, name, added, released: "2020-06-19" });
    const body = { results: [g(1, "Among Us", 7982), g(2, "The Last of Us: Winter Hunt", 0), g(3, "The Last of Us Part II", 7510), g(4, "The Last Of Us", 7377)] };
    expect(normalizeRawgSearch(body, "the last of u").map((r) => r.externalId)).toEqual(["3", "4", "2", "1"]);
    // Equally known games keep RAWG's order.
    expect(normalizeRawgSearch({ results: [g(5, "Hades Escape", 0), g(6, "Hades' Cave", 0)] }, "hades").map((r) => r.externalId)).toEqual(["5", "6"]);
  });

  it("asks for exact-ish matches without DLC, a full page for the ranking", () => {
    expect(rawgSearchParams("elden ring")).toEqual({ search: "elden ring", search_precise: "true", exclude_additions: "true", page_size: "40" });
  });

  it("merges with the other catalogs by name, so the game and the series sit together", () => {
    const series: SearchResult[] = [{ source: "tmdb", externalId: "71912", kind: "series", name: "The Witcher", year: 2019 }];
    const merged = mergeSearch("the witcher", [series, normalizeRawgSearch(witcherSearch, "the witcher")]);
    expect(merged.slice(0, 2).map((r) => `${r.kind}:${r.name}`)).toEqual(["series:The Witcher", "game:The Witcher 3: Wild Hunt"]);
  });
});

describe("games as a kind", () => {
  it("comes from RAWG, with numeric ids", () => {
    expect(isTitleKind("game")).toBe(true);
    expect(isTitleKind("podcast")).toBe(false);
    expect(sourceForKind("game")).toBe("rawg");
    expect(isExternalId("game", "3328")).toBe(true);
    expect(isExternalId("game", "the-witcher-3")).toBe(false);
  });
});

describe("RAWG art", () => {
  it("builds ready-made sizes from the media path: 420 for lists, 640 for pages, 1280 for cards", () => {
    expect(posterUrl("rawg", ART, "w185")).toBe(`https://media.rawg.io/media/resize/420/-/${ART}`);
    expect(posterUrl("rawg", ART)).toBe(`https://media.rawg.io/media/resize/640/-/${ART}`);
    expect(posterUrl("rawg", ART, "w780")).toBe(`https://media.rawg.io/media/resize/1280/-/${ART}`);
    expect(posterUrl("rawg", "../../etc/passwd")).toBeNull();
    expect(posterUrl("rawg", `https://media.rawg.io/media/${ART}`)).toBeNull();
  });

  it("draws cards with the big art, and lets only RAWG's own images on them", () => {
    const small = posterUrl("rawg", ART)!;
    expect(rawgMediaPath(small)).toBe(ART);
    expect(cardImageUrl(small)).toBe(`https://media.rawg.io/media/resize/1280/-/${ART}`);
    for (const ok of [small, `https://media.rawg.io/media/${ART}`, cardImageUrl(small)]) expect(isCardPosterUrl(ok), ok).toBe(true);
    for (const bad of [
      `https://media.rawg.io/media/resize/300/-/${ART}`,
      `https://media.rawg.io/media/crop/600/400/${ART}`,
      "https://media.rawg.io/media/avatars/abc/abc.jpg",
      `https://evil.example/media/${ART}`,
    ]) {
      expect(isCardPosterUrl(bad), bad).toBe(false);
    }
  });
});
