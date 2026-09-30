import { describe, expect, it } from "vitest";
import type { SearchResult } from "./catalog/types";
import { blendTrending, parsePick } from "./trending";

const title = (kind: SearchResult["kind"], externalId: string): SearchResult => ({
  source: kind === "book" ? "google_books" : kind === "manga" ? "anilist" : "tmdb",
  kind,
  externalId,
  name: `${kind} ${externalId}`,
});

describe("blendTrending", () => {
  it("puts Mystonie's own titles first, then fills with the world's, without repeats", () => {
    const own = [{ ...title("manga", "30013"), people: 12 }, { ...title("movie", "1"), people: 4 }];
    const world = [title("movie", "1"), title("series", "2"), title("movie", "3")];
    expect(blendTrending(own, world, 4).map((t) => [t.kind, t.externalId, t.people])).toEqual([
      ["manga", "30013", 12],
      ["movie", "1", 4],
      ["series", "2", undefined],
      ["movie", "3", undefined],
    ]);
  });

  it("keeps a movie and a series with the same id apart, and stops at the limit", () => {
    expect(blendTrending([], [title("movie", "7"), title("series", "7"), title("movie", "8")], 2)).toHaveLength(2);
    expect(blendTrending([], [title("movie", "7"), title("series", "7")], 9)).toHaveLength(2);
  });

  it("is the world's list alone until Mystonie has its own", () => {
    expect(blendTrending([], [title("movie", "1")], 9)).toEqual([title("movie", "1")]);
  });
});

describe("parsePick", () => {
  it("reads every kind with an id of its catalog", () => {
    expect(parsePick("movie:496243")).toEqual({ kind: "movie", externalId: "496243" });
    expect(parsePick("manga:30013")).toEqual({ kind: "manga", externalId: "30013" });
    expect(parsePick("book:zyTCAlFPjgYC")).toEqual({ kind: "book", externalId: "zyTCAlFPjgYC" });
    expect(parsePick("game:3328")).toEqual({ kind: "game", externalId: "3328" });
  });

  it("rejects anything else", () => {
    for (const raw of ["movie:abc", "book:123", "podcast:1", "movie:", "movie:1:2", undefined, ["movie:1"]]) {
      expect(parsePick(raw), String(raw)).toBeNull();
    }
  });
});
