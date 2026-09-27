import { describe, expect, it } from "vitest";
import { inRange, localDate, periodRange, safeTimeZone, startOfLocalDay, weekStartFor } from "./period";

const iso = (t: number) => new Date(t).toISOString();
const range = (r: ReturnType<typeof periodRange>) => r && [iso(r.from), iso(r.to)];

describe("periodRange", () => {
  // Monday 28 Sep 2026, 03:00 in Bangkok (UTC+7), still Sunday in UTC.
  const now = Date.parse("2026-09-27T20:00:00Z");
  const bangkok = { timeZone: "Asia/Bangkok", weekStart: 1, now };

  it("uses the local calendar, not UTC", () => {
    expect(range(periodRange("week", bangkok))).toEqual(["2026-09-27T17:00:00.000Z", "2026-10-04T17:00:00.000Z"]);
    expect(range(periodRange("month", bangkok))).toEqual(["2026-08-31T17:00:00.000Z", "2026-09-30T17:00:00.000Z"]);
    expect(range(periodRange("year", bangkok))).toEqual(["2025-12-31T17:00:00.000Z", "2026-12-31T17:00:00.000Z"]);
    expect(periodRange("all", bangkok)).toBeNull();
  });

  it("starts the week on the given day", () => {
    expect(range(periodRange("week", { ...bangkok, weekStart: 7 }))).toEqual([
      "2026-09-26T17:00:00.000Z",
      "2026-10-03T17:00:00.000Z",
    ]);
  });

  it("moves back and forth with offset, across year ends", () => {
    expect(range(periodRange("week", { ...bangkok, offset: -1 }))).toEqual([
      "2026-09-20T17:00:00.000Z",
      "2026-09-27T17:00:00.000Z",
    ]);
    const january = { timeZone: "UTC", weekStart: 1, now: Date.parse("2026-01-15T12:00:00Z") };
    expect(range(periodRange("month", { ...january, offset: -1 }))).toEqual([
      "2025-12-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    ]);
    expect(range(periodRange("year", { ...january, offset: 1 }))).toEqual([
      "2027-01-01T00:00:00.000Z",
      "2028-01-01T00:00:00.000Z",
    ]);
  });

  it("handles daylight saving time (New York, March 2026)", () => {
    const ny = { timeZone: "America/New_York", weekStart: 7, now: Date.parse("2026-03-09T12:00:00Z") };
    // Sunday 8 March 00:00 EST (−5) to Sunday 15 March 00:00 EDT (−4): one hour short of 7 days.
    expect(range(periodRange("week", ny))).toEqual(["2026-03-08T05:00:00.000Z", "2026-03-15T04:00:00.000Z"]);
    expect(range(periodRange("month", ny))).toEqual(["2026-03-01T05:00:00.000Z", "2026-04-01T04:00:00.000Z"]);
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(safeTimeZone("Mars/Base")).toBe("UTC");
    expect(range(periodRange("month", { timeZone: "Mars/Base", weekStart: 1, now }))).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ]);
  });
});

describe("startOfLocalDay", () => {
  // Days around DST changes, including zones where the change happens at midnight.
  const cases: [string, number, number, number][] = [
    ["America/New_York", 2026, 3, 8],
    ["America/New_York", 2026, 11, 1],
    ["Europe/London", 2026, 3, 29],
    ["America/Santiago", 2026, 9, 6],
    ["America/Santiago", 2026, 4, 5],
    ["America/Havana", 2026, 3, 8],
    ["Australia/Lord_Howe", 2026, 10, 4],
    ["Asia/Kolkata", 2026, 9, 27],
  ];

  it.each(cases)("%s %i-%i-%i is the first instant of that local day", (zone, y, m, d) => {
    const start = startOfLocalDay(y, m, d, zone);
    expect(localDate(start, zone)).toEqual({ year: y, month: m, day: d });
    expect(localDate(start - 1000, zone)).not.toEqual({ year: y, month: m, day: d });
  });
});

describe("weekStartFor", () => {
  it("follows the locale, Monday when unknown", () => {
    expect(weekStartFor("en-GB")).toBe(1);
    expect(weekStartFor("en-US")).toBe(7);
    expect(weekStartFor("de")).toBe(1);
    expect(weekStartFor("not a locale")).toBe(1);
  });
});

describe("inRange", () => {
  const r = { from: Date.parse("2026-09-01T00:00:00Z"), to: Date.parse("2026-10-01T00:00:00Z") };
  it("is half-open and ignores missing or bad timestamps", () => {
    expect(inRange("2026-09-01T00:00:00Z", r)).toBe(true);
    expect(inRange("2026-10-01T00:00:00Z", r)).toBe(false);
    expect(inRange("2026-09-15T10:00:00+07:00", null)).toBe(true);
    expect(inRange(null, null)).toBe(false);
    expect(inRange("yesterday", r)).toBe(false);
  });
});
