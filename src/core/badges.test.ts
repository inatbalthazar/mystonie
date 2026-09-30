import { describe, expect, it } from "vitest";
import { albumBadges, BADGE_FRESH_MS, BADGES, badgesToAward, badgesToCelebrate, evaluateBadges, isBadgeId, type BadgeProgress, type BadgeTitle } from "./badges";
import type { TitleKind } from "./catalog/types";
import type { StatsEntry } from "./stats/summary";

let n = 0;
function title(kind: TitleKind, genres: string[] = [], originalLanguage: string | null = "en"): BadgeTitle {
  n += 1;
  return { id: `t${String(n).padStart(3, "0")}`, kind, genres, originalLanguage };
}
const finish = (t: BadgeTitle, finishedAt: string, extra: Partial<StatsEntry> = {}): StatsEntry => ({
  id: `e-${t.id}`,
  titleId: t.id,
  status: "finished",
  finishedAt,
  ...extra,
});
const day = (d: number, h = 12) => `2026-09-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;
const get = (all: BadgeProgress[], id: string) => all.find((b) => b.id === id)!;

describe("evaluateBadges", () => {
  it("awards Rookie Bookworm on the 5th book, with the finish that got there", () => {
    const books = Array.from({ length: 6 }, () => title("book"));
    const entries = books.map((b, i) => finish(b, day(i + 1)));
    const all = evaluateBadges(books, entries, "UTC");
    expect(get(all, "rookie-bookworm")).toEqual({ id: "rookie-bookworm", target: 5, progress: 5, earnedAt: Date.parse(day(5)), titleId: books[4]!.id });
    expect(get(all, "first-book")).toMatchObject({ progress: 1, earnedAt: Date.parse(day(1)), titleId: books[0]!.id });
    expect(get(all, "bookworm")).toMatchObject({ progress: 6, earnedAt: null, titleId: null });
  });

  it("awards Player One on the first game and Level Up on the 10th (S3 games)", () => {
    const games = Array.from({ length: 10 }, () => title("game", ["RPG"], null));
    const all = evaluateBadges(games, games.map((g, i) => finish(g, day(i + 1))), "UTC");
    expect(get(all, "first-game")).toMatchObject({ progress: 1, earnedAt: Date.parse(day(1)), titleId: games[0]!.id });
    expect(get(all, "level-up")).toMatchObject({ target: 10, progress: 10, earnedAt: Date.parse(day(10)), titleId: games[9]!.id });
    // Games count towards every kind of range, not towards the other kinds' firsts.
    expect(get(all, "first-movie").progress).toBe(0);
  });

  it("returns the whole catalogue in order, and doesn't depend on row order", () => {
    const books = Array.from({ length: 5 }, () => title("book"));
    const entries = books.map((b) => finish(b, day(3)));
    const a = evaluateBadges(books, entries, "UTC");
    const b = evaluateBadges([...books].reverse(), [...entries].reverse(), "UTC");
    expect(a.map((x) => x.id)).toEqual(BADGES.map((x) => x.id));
    expect(b).toEqual(a);
    expect(get(a, "rookie-bookworm").titleId).toBe(books[4]!.id);
  });

  it("only counts live finishes with a date", () => {
    const books = Array.from({ length: 5 }, () => title("book"));
    const entries = [
      finish(books[0]!, day(1)),
      finish(books[1]!, day(2)),
      finish(books[2]!, day(3)),
      finish(books[3]!, day(4), { deletedAt: day(5) }),
      finish(books[4]!, day(5), { status: "watching", finishedAt: null }),
    ];
    expect(get(evaluateBadges(books, entries, "UTC"), "rookie-bookworm")).toMatchObject({ progress: 3, earnedAt: null });
  });

  it("filters by language and genre (K-drama, anime, horror in any kind)", () => {
    const korean = Array.from({ length: 5 }, () => title("series", ["Drama"], "ko"));
    const koreanMovie = title("movie", ["Drama"], "ko");
    const anime = Array.from({ length: 10 }, (_, i) => title(i % 2 ? "series" : "movie", ["Animation", "Action"], "ja"));
    const japaneseDrama = title("series", ["Drama"], "ja");
    const horror = [...Array.from({ length: 8 }, () => title("movie", ["Horror"])), title("book", ["Fiction", "Horror"]), title("manga", ["HORROR"])];
    const titles = [...korean, koreanMovie, ...anime, japaneseDrama, ...horror];
    const all = evaluateBadges(titles, titles.map((t, i) => finish(t, new Date(Date.parse(day(1)) + i * 60_000).toISOString())), "UTC");
    expect(get(all, "kdrama-fan")).toMatchObject({ progress: 5, titleId: korean[4]!.id });
    expect(get(all, "anime-fan")).toMatchObject({ progress: 10, titleId: anime[9]!.id });
    expect(get(all, "fear-conqueror")).toMatchObject({ progress: 10, titleId: horror[9]!.id });
    expect(get(all, "stargazer").progress).toBe(0);
  });

  it("counts different languages, genres and kinds", () => {
    const titles = [title("movie", ["Drama"], "en"), title("series", ["Comedy"], "ko"), title("book", ["Fiction"], "fr"), title("manga", ["Action"], "ja"), title("movie", ["Drama"], "EN")];
    const all = evaluateBadges(titles, titles.map((t, i) => finish(t, day(i + 1))), "UTC");
    expect(get(all, "all-rounder")).toMatchObject({ progress: 4, earnedAt: Date.parse(day(4)), titleId: titles[3]!.id });
    expect(get(all, "subtitles-on")).toMatchObject({ progress: 4, earnedAt: null });
    expect(get(all, "genre-hopper").progress).toBe(4);
  });

  it("finds three movies on one local day in the user's time zone", () => {
    const movies = Array.from({ length: 3 }, () => title("movie"));
    // Two on the 1st and one on the 2nd in UTC, but all three on the 2nd in Bangkok (UTC+7).
    const entries = [finish(movies[0]!, "2026-09-01T18:00:00Z"), finish(movies[1]!, "2026-09-01T20:00:00Z"), finish(movies[2]!, "2026-09-02T01:00:00Z")];
    expect(get(evaluateBadges(movies, entries, "UTC"), "triple-feature")).toMatchObject({ progress: 2, earnedAt: null });
    expect(get(evaluateBadges(movies, entries, "Asia/Bangkok"), "triple-feature")).toMatchObject({
      progress: 3,
      earnedAt: Date.parse("2026-09-02T01:00:00Z"),
      titleId: movies[2]!.id,
    });
  });
});

describe("awarding", () => {
  const books = Array.from({ length: 5 }, () => title("book"));
  const progress = evaluateBadges(books, books.map((b, i) => finish(b, day(i + 1))), "UTC");

  it("awards only what was earned and isn't awarded yet, oldest first", () => {
    expect(badgesToAward(progress, new Set()).map((b) => b.id)).toEqual(["first-book", "rookie-bookworm"]);
    expect(badgesToAward(progress, new Set(["first-book", "rookie-bookworm"]))).toEqual([]);
  });

  it("celebrates every new badge once someone has badges, and only fresh ones on a first check", () => {
    const awarded = badgesToAward(progress, new Set());
    const now = Date.parse(day(5)) + BADGE_FRESH_MS - 1;
    expect(badgesToCelebrate(awarded, true, now).map((b) => b.id)).toEqual(["first-book", "rookie-bookworm"]);
    expect(badgesToCelebrate(awarded, false, now).map((b) => b.id)).toEqual(["rookie-bookworm"]);
    expect(badgesToCelebrate(awarded, false, now + 2)).toEqual([]);
  });

  it("keeps awarded badges in the album after their finishes are gone", () => {
    const empty = evaluateBadges([], [], "UTC");
    const album = albumBadges(empty, [{ id: "rookie-bookworm", earnedAt: day(5), titleName: "Dune" }], () => null);
    expect(album).toHaveLength(BADGES.length);
    expect(album.find((b) => b.id === "rookie-bookworm")).toEqual({ id: "rookie-bookworm", target: 5, progress: 5, earnedAt: day(5), titleName: "Dune" });
    expect(album.find((b) => b.id === "bookworm")).toEqual({ id: "bookworm", target: 25, progress: 0, earnedAt: null, titleName: null });
  });

  it("shows a badge earned but not awarded yet as earned", () => {
    const album = albumBadges(progress, [], (id) => (id === books[4]!.id ? "Book five" : null));
    expect(album.find((b) => b.id === "rookie-bookworm")).toMatchObject({ progress: 5, earnedAt: new Date(day(5)).toISOString(), titleName: "Book five" });
  });

  it("knows its slugs", () => {
    expect(isBadgeId("rookie-bookworm")).toBe(true);
    expect(isBadgeId("admin")).toBe(false);
    expect(isBadgeId(5)).toBe(false);
  });
});
