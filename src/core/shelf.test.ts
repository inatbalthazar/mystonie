import { describe, expect, it } from "vitest";
import { shelfItems, type ShelfTitle } from "./shelf";
import type { StatsEntry } from "./stats/summary";

const title = (id: string, kind: ShelfTitle["kind"] = "movie"): ShelfTitle => ({ id, kind, name: id.toUpperCase(), posterUrl: null });
const entry = (titleId: string, finishedAt: string | null, extra: Partial<StatsEntry> = {}): StatsEntry => ({
  id: `e-${titleId}`,
  titleId,
  status: finishedAt ? "finished" : "watching",
  finishedAt,
  ...extra,
});

describe("shelfItems", () => {
  const titles = [title("a"), title("b", "book"), title("c", "series"), title("d", "manga"), title("e")];
  const entries = [
    entry("a", "2026-09-01T10:00:00Z"),
    entry("b", "2026-09-03T10:00:00Z"),
    entry("c", "2026-09-02T10:00:00Z"),
    entry("d", null),
    entry("e", "2026-09-04T10:00:00Z", { deletedAt: "2026-09-05T10:00:00Z" }),
  ];

  it("lists live finishes, newest first", () => {
    expect(shelfItems(titles, entries, 10)).toEqual({ items: [titles[1], titles[2], titles[0]], more: 0 });
  });

  it("stops at max and counts the rest", () => {
    expect(shelfItems(titles, entries, 2)).toEqual({ items: [titles[1], titles[2]], more: 1 });
  });

  it("breaks ties by title id", () => {
    const same = [entry("c", "2026-09-01T10:00:00Z"), entry("a", "2026-09-01T10:00:00Z")];
    expect(shelfItems(titles, same, 5).items.map((t) => t.id)).toEqual(["a", "c"]);
  });
});
