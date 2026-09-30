import { describe, expect, it } from "vitest";
import { clubFit, clubRpcFilter, clubsForTitle, CLUBS, findClub, isClubSlug, orderClubs, parseClubToggle } from "./clubs";
import type { StatsEntry } from "./stats/summary";

describe("the club catalogue", () => {
  it("has unique slugs that fit the database's format", () => {
    expect(new Set(CLUBS.map((c) => c.slug)).size).toBe(CLUBS.length);
    for (const c of CLUBS) expect(c.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(isClubSlug("kdrama")).toBe(true);
    expect(isClubSlug("KDRAMA")).toBe(false);
    expect(findClub("nope")).toBeNull();
  });

  it("passes each club's filter to SQL as lists, leaving out what doesn't filter", () => {
    expect(clubRpcFilter(findClub("kdrama")!)).toEqual({ p_kinds: ["series"], p_genres: undefined, p_languages: ["ko"] });
    expect(clubRpcFilter(findClub("horror")!)).toEqual({ p_kinds: undefined, p_genres: ["horror"], p_languages: undefined });
  });
});

describe("clubsForTitle", () => {
  it("puts a Korean mystery series in the K-drama and Mystery clubs", () => {
    expect(clubsForTitle({ kind: "series", genres: ["Mystery", "Drama"], originalLanguage: "ko" })).toEqual(["kdrama", "mystery"]);
  });

  it("needs every part of a filter: a Japanese live-action series isn't anime", () => {
    expect(clubsForTitle({ kind: "series", genres: ["Drama"], originalLanguage: "ja" })).toEqual([]);
    expect(clubsForTitle({ kind: "movie", genres: ["Animation", "Fantasy"], originalLanguage: "ja" })).toEqual(["anime", "scifi"]);
  });

  it("puts books and manga in their clubs whatever the language", () => {
    expect(clubsForTitle({ kind: "manga", genres: ["Horror"], originalLanguage: null })).toEqual(["manga", "horror"]);
    expect(clubsForTitle({ kind: "book", genres: [], originalLanguage: "th" })).toEqual(["books"]);
  });

  it("puts games in Gamers, and a horror game in Horror too (S3 games)", () => {
    expect(clubsForTitle({ kind: "game", genres: ["Action", "RPG"], originalLanguage: null })).toEqual(["games"]);
    expect(clubsForTitle({ kind: "game", genres: ["Horror"], originalLanguage: null })).toEqual(["games", "horror"]);
  });
});

describe("clubFit and orderClubs", () => {
  const titles = [
    { id: "a", kind: "series" as const, genres: ["Romance"], originalLanguage: "ko" },
    { id: "b", kind: "series" as const, genres: ["Comedy"], originalLanguage: "ko" },
    { id: "c", kind: "movie" as const, genres: ["Horror"], originalLanguage: "en" },
  ];
  const entries: StatsEntry[] = [
    { id: "1", titleId: "a", status: "finished", finishedAt: "2026-09-01T00:00:00Z" },
    { id: "2", titleId: "b", status: "finished", finishedAt: "2026-09-02T00:00:00Z" },
    { id: "3", titleId: "c", status: "watching", finishedAt: null },
  ];

  it("counts only live finishes", () => {
    const fit = clubFit(titles, entries);
    expect(fit.get("kdrama")).toBe(2);
    expect(fit.get("romance")).toBe(1);
    expect(fit.get("horror")).toBe(0);
  });

  it("lists your clubs first, then the ones you fit best, then the catalogue order", () => {
    const order = orderClubs(new Set(["horror"]), clubFit(titles, entries));
    expect(order.slice(0, 5)).toEqual(["horror", "kdrama", "romance", "comedy", "anime"]);
    expect(order).toHaveLength(CLUBS.length);
  });
});

describe("parseClubToggle", () => {
  it("takes a known club and a boolean", () => {
    expect(parseClubToggle({ club: "anime", join: true })).toEqual({ club: "anime", on: true });
    expect(parseClubToggle({ club: "anime", join: 1 })).toBeNull();
    expect(parseClubToggle({ club: "pirates", join: true })).toBeNull();
    expect(parseClubToggle([])).toBeNull();
  });
});
