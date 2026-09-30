import { describe, expect, it } from "vitest";
import { uuidv7 } from "../ids";
import { finishRemainder, parseReadingLog, readingAmounts, readingPosition, type ReadingLog } from "./reading";

const log = (id: string, unit: ReadingLog["unit"], position: number, readAt: string, deletedAt: string | null = null): ReadingLog => ({
  id,
  titleId: "t",
  unit,
  position,
  readAt,
  deletedAt,
});

describe("readingAmounts", () => {
  it("counts how far each log moves past the furthest point before it", () => {
    const logs = [
      log("c", "chapter", 1100, "2026-09-20T10:00:00Z"),
      log("a", "chapter", 1095, "2026-09-01T10:00:00Z"),
      log("d", "chapter", 1098, "2026-09-21T10:00:00Z"), // going back adds nothing
      log("e", "chapter", 1102, "2026-09-22T10:00:00Z"),
      log("v", "volume", 3, "2026-09-22T11:00:00Z"),
      log("x", "chapter", 1200, "2026-09-23T10:00:00Z", "2026-09-23T11:00:00Z"), // deleted
    ];
    expect(readingAmounts(logs).map(({ log, amount }) => [log.id, amount])).toEqual([
      ["a", 1095],
      ["c", 5],
      ["d", 0],
      ["e", 2],
      ["v", 3],
    ]);
    expect(readingPosition(logs, "chapter")).toBe(1102);
    expect(readingPosition(logs, "page")).toBe(0);
  });
});

describe("finishRemainder", () => {
  it("adds the rest of a book's pages, or all of them without logs", () => {
    const book = { kind: "book" as const, pageCount: 320 };
    expect(finishRemainder(book, [])).toEqual({ unit: "page", amount: 320 });
    expect(finishRemainder(book, [log("a", "page", 120, "2026-09-01T00:00:00Z")])).toEqual({ unit: "page", amount: 200 });
    expect(finishRemainder(book, [log("a", "page", 320, "2026-09-01T00:00:00Z")])).toBeNull();
    expect(finishRemainder({ kind: "book", pageCount: null }, [])).toBeNull();
  });

  it("uses chapters for a manga, volumes when only volumes were logged or chapters are unknown", () => {
    const manga = { kind: "manga" as const, chapterCount: 232, volumeCount: 24 };
    expect(finishRemainder(manga, [])).toEqual({ unit: "chapter", amount: 232 });
    expect(finishRemainder(manga, [log("a", "volume", 20, "2026-09-01T00:00:00Z")])).toEqual({ unit: "volume", amount: 4 });
    expect(finishRemainder({ kind: "manga", chapterCount: null, volumeCount: 7 }, [])).toEqual({ unit: "volume", amount: 7 });
    expect(finishRemainder({ kind: "manga", chapterCount: null, volumeCount: null }, [])).toBeNull();
  });
});

describe("parseReadingLog", () => {
  const id = uuidv7();
  it("accepts a chapter of a manga and a page of a book", () => {
    const now = Date.parse("2026-09-27T20:00:00Z");
    expect(parseReadingLog({ id, kind: "manga", externalId: "30013", unit: "chapter", position: 1100 }, now)).toEqual({
      id,
      kind: "manga",
      externalId: "30013",
      unit: "chapter",
      position: 1100,
      readAt: "2026-09-27T20:00:00.000Z",
    });
    // A log made offline keeps its own time (ADR 0042).
    const offline = { id, kind: "manga", externalId: "30013", unit: "chapter", position: 3, readAt: "2026-09-26T21:30:00Z" };
    expect(parseReadingLog(offline, now)?.readAt).toBe("2026-09-26T21:30:00.000Z");
    expect(parseReadingLog({ id, kind: "book", externalId: "3fzJEAAAQBAJ", unit: "page", position: 1 })).not.toBeNull();
  });

  it("rejects units that don't fit the kind, bad ids and positions", () => {
    const ok = { id, kind: "manga", externalId: "30013", unit: "chapter", position: 5 };
    for (const bad of [
      { ...ok, unit: "page" },
      { ...ok, kind: "book", unit: "chapter" },
      { ...ok, kind: "series" },
      { ...ok, externalId: "abc" },
      { ...ok, id: "00000000-0000-4000-8000-000000000000" },
      { ...ok, position: 0 },
      { ...ok, position: 1.5 },
      { ...ok, position: 100_001 },
      { ...ok, readAt: "tomorrow" },
      null,
    ]) {
      expect(parseReadingLog(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});
