import { describe, expect, it } from "vitest";
import witcher from "./fixtures/rawg-game-3328.json";
import witcherSearch from "./fixtures/rawg-search-witcher.json";
import { cardImageUrl, isCardPosterUrl, posterUrl, rawgMediaPath } from "./images";
import { normalizeRawgDetails, normalizeRawgSearch, rawgSearchParams } from "./rawg";
import { mergeSearch } from "./search";
import { isExternalId, isTitleKind, sourceForKind, type SearchResult } from "./types";

// Fixtures: RAWG's own game objects (from its website's page data, the same objects its API serves), trimmed; the
// platform lists are in the API's shape, `[{ platform: { id, name, slug } }]`.

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

  it("leaves adults-only games out", () => {
    expect(normalizeRawgDetails({ ...witcher, esrb_rating: { id: 5, name: "Adults Only", slug: "adults-only" } })).toBeNull();
    expect(normalizeRawgDetails({ ...witcher, tags: [...witcher.tags, { id: 50, name: "NSFW", slug: "nsfw" }] })).toBeNull();
    // Mature games stay: The Witcher 3 is rated M.
    expect(normalizeRawgDetails(witcher)).not.toBeNull();
  });

  it("reads platforms as the API sends them, and as plain slugs", () => {
    expect(normalizeRawgDetails({ ...witcher, parent_platforms: ["pc", "playstation", "sega"] })?.platforms).toEqual(["PC", "PlayStation"]);
    const sega = [{ platform: { id: 11, name: "SEGA", slug: "sega" } }];
    expect(normalizeRawgDetails({ ...witcher, parent_platforms: sega })?.platforms).toEqual(["SEGA"]);
  });
});

describe("RAWG search", () => {
  it("lists games in RAWG's order, each labelled a game with its platforms and small art", () => {
    const results = normalizeRawgSearch(witcherSearch);
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
    expect(normalizeRawgSearch({ results: [first, first, { id: 1 }, null] })).toHaveLength(1);
    expect(normalizeRawgSearch({ error: "The key parameter is not provided" })).toEqual([]);
    expect(normalizeRawgSearch(null)).toEqual([]);
  });

  it("asks for exact-ish matches without DLC", () => {
    expect(rawgSearchParams("elden ring")).toEqual({ search: "elden ring", search_precise: "true", exclude_additions: "true", page_size: "20" });
  });

  it("merges with the other catalogs by name, so the game and the series sit together", () => {
    const series: SearchResult[] = [{ source: "tmdb", externalId: "71912", kind: "series", name: "The Witcher", year: 2019 }];
    const merged = mergeSearch("the witcher", [series, normalizeRawgSearch(witcherSearch)]);
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
    expect(cardImageUrl("https://image.tmdb.org/t/p/w342/x.jpg")).toBe("https://image.tmdb.org/t/p/w342/x.jpg");
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
