import { describe, expect, it } from "vitest";
import { summarizeCollection } from "../stats/summary";
import type { CollectionItem } from "./entries";
import { collectionRows, collectionYears, sortRows, summarizeRows, yearRange, type WatchLog } from "./view";

const item = (
  id: string,
  name: string,
  kind: "movie" | "series",
  status: CollectionItem["status"],
  finishedAt: string | null,
  runtimeMin: number | null,
  episodeCount: number | null = null,
): CollectionItem => ({
  id,
  status,
  finishedAt,
  addedAt: "2025-06-01T00:00:00Z",
  title: { id: `t-${id}`, source: "tmdb", kind, externalId: id.replace(/\D/g, "") || "1", name, year: 2020, posterUrl: null, runtimeMin, episodeCount },
});

const ITEMS = [
  item("e1", "Parasite", "movie", "finished", "2026-03-10T12:00:00Z", 132),
  item("e2", "Dune", "movie", "want", null, 155),
  item("e3", "Chernobyl", "series", "finished", "2025-11-20T12:00:00Z", 65, 5),
  item("e4", "arcane", "series", "watching", null, 40, 18),
  // Finished at 23:30 on 31 Dec in Bangkok = 2025 locally, 2025 in UTC too; the next one is 2026 only in Bangkok.
  item("e5", "Ängel", "movie", "finished", "2025-12-31T17:30:00Z", 90),
];

const LOGS: WatchLog[] = [
  { id: "l1", titleId: "t-e4", runtimeMin: 42, watchedAt: "2025-12-30T12:00:00Z" },
  { id: "l2", titleId: "t-e4", runtimeMin: null, watchedAt: "2026-01-02T12:00:00Z" },
  { id: "l3", titleId: "t-other", runtimeMin: 50, watchedAt: "2024-01-02T12:00:00Z" },
];

const TZ = "Asia/Bangkok";
const all = { year: null, status: null };

describe("collectionRows + summarizeRows", () => {
  it("counts every entry, all time", () => {
    const rows = collectionRows(ITEMS, LOGS, all, TZ);
    expect(rows).toHaveLength(5);
    expect(summarizeRows(rows)).toEqual({ minutes: 132 + 65 * 5 + 42 + 40 + 90, episodes: 5 + 2, finished: 3 });
    const arcane = rows.find((r) => r.item.id === "e4")!;
    expect(arcane).toMatchObject({ episodesLogged: 2, lengthMin: 82 });
    expect(rows.find((r) => r.item.id === "e2")).toMatchObject({ lengthMin: 155, watch: { minutes: 0 } });
  });

  it("scopes a year to the user's time zone", () => {
    const y2026 = collectionRows(ITEMS, LOGS, { year: 2026, status: null }, TZ);
    expect(y2026.map((r) => r.item.id)).toEqual(["e1", "e4", "e5"]);
    expect(summarizeRows(y2026)).toEqual({ minutes: 132 + 40 + 90, episodes: 1, finished: 2 });
    const utc2026 = collectionRows(ITEMS, LOGS, { year: 2026, status: null }, "UTC");
    expect(utc2026.map((r) => r.item.id)).toEqual(["e1", "e4"]);
  });

  it("filters by status", () => {
    expect(collectionRows(ITEMS, LOGS, { year: null, status: "want" }, TZ).map((r) => r.item.id)).toEqual(["e2"]);
    expect(collectionRows(ITEMS, LOGS, { year: 2026, status: "want" }, TZ)).toEqual([]);
  });

  it("matches summarizeCollection over the same entries", () => {
    const stats = summarizeCollection(
      ITEMS.map((i) => ({ id: i.title.id!, kind: i.title.kind, runtimeMin: i.title.runtimeMin!, episodeCount: i.title.episodeCount! })),
      ITEMS.map((i) => ({ id: i.id, titleId: i.title.id!, status: i.status, finishedAt: i.finishedAt })),
      LOGS.filter((l) => l.titleId !== "t-other"),
      yearRange(2026, TZ),
    );
    const rows = summarizeRows(collectionRows(ITEMS, LOGS, { year: 2026, status: null }, TZ));
    expect(rows).toEqual({ minutes: stats.minutes, episodes: stats.episodes, finished: stats.finished });
  });

  it("handles optimistic rows without catalog details", () => {
    const fresh: CollectionItem = { ...ITEMS[0]!, id: "e9", title: { ...ITEMS[0]!.title, id: undefined, runtimeMin: undefined } };
    expect(collectionRows([fresh], LOGS, all, TZ)[0]).toMatchObject({ lengthMin: null, watch: { minutes: 0, finished: 1 } });
  });
});

describe("collectionYears", () => {
  it("lists years with finishes or logs of titles in the collection, newest first", () => {
    expect(collectionYears(ITEMS, LOGS, TZ)).toEqual([2026, 2025]);
    expect(collectionYears(ITEMS, LOGS, "Not/AZone")).toEqual([2026, 2025]);
    expect(collectionYears([], LOGS, TZ)).toEqual([]);
  });
});

describe("sortRows", () => {
  const rows = collectionRows(ITEMS, LOGS, all, TZ);
  const ids = (sort: Parameters<typeof sortRows>[1]) => sortRows(rows, sort, "en").map((r) => r.item.id);

  it("sorts by finish date, newest first (want/watching by date added)", () => {
    expect(ids("finished")).toEqual(["e1", "e5", "e3", "e4", "e2"]); // same add time: newest id first
  });

  it("sorts titles A–Z ignoring case and accents", () => {
    expect(ids("title")).toEqual(["e5", "e4", "e3", "e2", "e1"]);
  });

  it("sorts by length, longest first", () => {
    expect(ids("runtime")).toEqual(["e3", "e2", "e1", "e5", "e4"]);
  });
});
