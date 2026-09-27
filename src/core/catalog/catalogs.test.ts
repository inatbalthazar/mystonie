import { describe, expect, it } from "vitest";
import { normalizeAnilistDetails, normalizeAnilistSearch } from "./anilist";
import mangaChainsaw from "./fixtures/anilist-manga-105778.json";
import mangaOnePiece from "./fixtures/anilist-manga-30013.json";
import anilistSearch from "./fixtures/anilist-search-one-piece.json";
import booksSearch from "./fixtures/google-books-search.json";
import { normalizeGoogleBooksDetails, normalizeGoogleBooksSearch } from "./google-books";
import { isCardPosterUrl, posterUrl } from "./images";
import { mergeSearch, searchKey } from "./search";
import { isExternalId, sourceForKind, type SearchResult } from "./types";

describe("AniList", () => {
  it("normalizes a manga search, English title first", () => {
    const results = normalizeAnilistSearch(anilistSearch);
    expect(results[0]).toEqual({
      source: "anilist",
      externalId: "30013",
      kind: "manga",
      name: "One Piece",
      originalName: "ONE PIECE",
      originalLanguage: "ja",
      year: 1997,
      imageUrl: expect.stringMatching(/^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/media\/manga\/cover\/medium\//),
    });
    // No English title: the romanized one.
    expect(results.find((r) => r.externalId === "102533")?.name).toBe("One Piece Party");
    expect(results).toHaveLength(anilistSearch.data.Page.media.length);
  });

  it("keeps chapters and volumes, null while a manga is running", () => {
    expect(normalizeAnilistDetails(mangaOnePiece)).toMatchObject({ kind: "manga", chapterCount: null, volumeCount: null, runtimeMin: null });
    expect(normalizeAnilistDetails(mangaChainsaw)).toMatchObject({
      source: "anilist",
      externalId: "105778",
      name: "Chainsaw Man",
      originalName: "チェンソーマン",
      chapterCount: 232,
      volumeCount: 24,
      genres: ["Action", "Comedy", "Drama", "Horror", "Supernatural"],
      posterPath: expect.stringContaining("/cover/large/"),
    });
  });

  it("drops adult titles, novels, odd covers and junk", () => {
    const media = mangaChainsaw.data.Media;
    expect(normalizeAnilistDetails({ data: { Media: { ...media, isAdult: true } } })).toBeNull();
    expect(normalizeAnilistDetails({ data: { Media: { ...media, format: "NOVEL" } } })).toBeNull();
    expect(normalizeAnilistDetails({ data: { Media: { ...media, coverImage: { large: "https://evil.example/x.png" } } } })!.posterPath).toBeNull();
    expect(normalizeAnilistDetails({ data: { Media: null } })).toBeNull();
    expect(normalizeAnilistSearch({ errors: [{ message: "Too Many Requests." }] })).toEqual([]);
  });
});

describe("Google Books", () => {
  it("normalizes a search: cover through our proxy, first author, no duplicates or mature books", () => {
    expect(normalizeGoogleBooksSearch(booksSearch)).toEqual([
      {
        source: "google_books",
        externalId: "3fzJEAAAQBAJ",
        kind: "book",
        name: "Project Hail Mary",
        originalLanguage: "en",
        year: 2021,
        imageUrl: "/api/covers/3fzJEAAAQBAJ",
        creator: "Andy Weir",
      },
      { source: "google_books", externalId: "zyTCAlFPjgYC", kind: "book", name: "The Google Story", originalLanguage: "en", year: 2005, creator: "David A. Vise" },
    ]);
  });

  it("keeps the page count (null when missing) and splits categories into genres", () => {
    expect(normalizeGoogleBooksDetails(booksSearch.items[0])).toEqual({
      source: "google_books",
      externalId: "3fzJEAAAQBAJ",
      kind: "book",
      name: "Project Hail Mary",
      originalName: null,
      originalLanguage: "en",
      year: 2021,
      posterPath: "3fzJEAAAQBAJ",
      genres: ["Fiction", "Science Fiction", "Space Opera"],
      runtimeMin: null,
      episodeCount: null,
      seasonCount: null,
      pageCount: 496,
      chapterCount: null,
      volumeCount: null,
    });
    expect(normalizeGoogleBooksDetails(booksSearch.items[1])).toMatchObject({ pageCount: null, posterPath: null });
  });
});

describe("catalog ids and posters", () => {
  it("maps kinds to catalogs and checks their ids", () => {
    expect(["movie", "series", "book", "manga"].map((k) => sourceForKind(k as never))).toEqual(["tmdb", "tmdb", "google_books", "anilist"]);
    expect(isExternalId("manga", "30013")).toBe(true);
    expect(isExternalId("book", "3fzJEAAAQBAJ")).toBe(true);
    expect(isExternalId("book", "30013")).toBe(false);
    expect(isExternalId("series", "3fzJEAAAQBAJ")).toBe(false);
  });

  it("builds poster URLs per catalog and only lets catalog images on cards", () => {
    expect(posterUrl("tmdb", "/x.jpg")).toBe("https://image.tmdb.org/t/p/w342/x.jpg");
    expect(posterUrl("google_books", "3fzJEAAAQBAJ")).toBe("/api/covers/3fzJEAAAQBAJ");
    expect(posterUrl("google_books", "3fzJEAAAQBAJ", "w780")).toBe("/api/covers/3fzJEAAAQBAJ?size=large");
    const cover = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg";
    expect(posterUrl("anilist", cover)).toBe(cover);
    expect(posterUrl("anilist", "https://evil.example/x.jpg")).toBeNull();
    expect(posterUrl("google_books", "../../etc")).toBeNull();

    for (const ok of [posterUrl("tmdb", "/x.jpg")!, "/api/covers/3fzJEAAAQBAJ", "/api/covers/3fzJEAAAQBAJ?size=large", cover]) {
      expect(isCardPosterUrl(ok), ok).toBe(true);
    }
    for (const bad of ["/api/covers/3fzJEAAAQBAJ?size=huge", "/api/covers/short", "https://s4.anilist.co/file/x.jpg", "//evil.example/x.jpg"]) {
      expect(isCardPosterUrl(bad), bad).toBe(false);
    }
  });
});

describe("mergeSearch", () => {
  const tmdb: SearchResult[] = [
    { source: "tmdb", externalId: "37854", kind: "series", name: "One Piece", year: 1999 },
    { source: "tmdb", externalId: "111110", kind: "series", name: "ONE PIECE", year: 2023 },
    { source: "tmdb", externalId: "900667", kind: "movie", name: "One Piece Film Red", year: 2022 },
  ];
  const books: SearchResult[] = [
    { source: "google_books", externalId: "AAAAAAAAAAAA", kind: "book", name: "One Piece, Vol. 1", year: 2003 },
    { source: "google_books", externalId: "BBBBBBBBBBBB", kind: "book", name: "Pirates of the Grand Line", year: 2010 },
  ];

  it("puts the manga next to the series for “one piece”", () => {
    const merged = mergeSearch("One Piece", [tmdb, normalizeAnilistSearch(anilistSearch), books]);
    expect(merged.slice(0, 3).map((r) => `${r.kind}:${r.name}`)).toEqual(["series:One Piece", "manga:One Piece", "series:ONE PIECE"]);
    // Names that don't start with the query come after the ones that do.
    const at = (name: string) => merged.findIndex((r) => r.name === name);
    expect(at("One Piece, Vol. 1")).toBeLessThan(at("Pirates of the Grand Line"));
    expect(at("ONE PIECE ACADEMY")).toBeLessThan(at("Boku no One Piece"));
    expect(new Set(merged.map((r) => r.kind))).toEqual(new Set(["series", "movie", "manga", "book"]));
  });

  it("drops duplicates and keeps the limit", () => {
    expect(mergeSearch("one", [tmdb, tmdb], 2)).toHaveLength(2);
    expect(mergeSearch("one", [tmdb, tmdb])).toHaveLength(3);
  });

  it("compares names without case, accents or punctuation", () => {
    expect(searchKey("ONE PIECE, Vol. 1")).toBe("one piece vol 1");
    expect(searchKey("Pokémon")).toBe("pokemon");
  });
});
