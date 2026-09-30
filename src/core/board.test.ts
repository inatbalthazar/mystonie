import { describe, expect, it } from "vitest";
import { boardPlace, boardStart, isBoardPeriod, rankBoard } from "./board";
import type { CardRecap } from "./cards/types";

const recap = (minutes: number, finished = 0, episodes = 0, readMinutes?: number): CardRecap => ({
  from: "2026-09-28",
  to: "2026-10-04",
  minutes,
  episodes,
  finished,
  titleCount: 1,
  titles: [],
  ...(readMinutes ? { readMinutes } : {}),
});
const person = (id: string, r: CardRecap | null) => ({ id, username: id, displayName: null, avatarUrl: null, recap: r });

describe("boardStart", () => {
  it("starts the week on the local Monday and the month on the 1st", () => {
    // Wednesday 2026-09-30 10:00 UTC.
    const now = Date.UTC(2026, 8, 30, 10);
    expect(boardStart("week", now, "UTC")).toBe("2026-09-28");
    expect(boardStart("month", now, "UTC")).toBe("2026-09-01");
    // Already Thursday 1 October in Kiritimati (UTC+14).
    expect(boardStart("month", now, "Pacific/Kiritimati")).toBe("2026-10-01");
    expect(boardStart("week", now, "Not/AZone")).toBe("2026-09-28");
  });

  it("knows its periods", () => {
    expect(isBoardPeriod("week")).toBe(true);
    expect(isBoardPeriod("year")).toBe(false);
  });
});

describe("rankBoard", () => {
  it("ranks by time (watching plus reading), then finishes, then episodes", () => {
    const rows = rankBoard(
      [person("ann", recap(120, 1)), person("bo", recap(60, 0, 0, 90)), person("cy", recap(120, 2)), person("me", recap(30))],
      "me",
    );
    expect(rows.map((r) => [r.username, r.rank, r.minutes])).toEqual([
      ["bo", 1, 150],
      ["cy", 2, 120],
      ["ann", 3, 120],
      ["me", 4, 30],
    ]);
    expect(rows.find((r) => r.me)?.username).toBe("me");
  });

  it("shares a place on a tie", () => {
    const rows = rankBoard([person("a", recap(60, 1)), person("b", recap(60, 1)), person("c", recap(10))], "a");
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("leaves out quiet people but always shows the viewer, last and unranked when quiet", () => {
    const rows = rankBoard([person("me", null), person("quiet", null), person("busy", recap(0, 1))], "me");
    expect(rows.map((r) => [r.username, r.rank])).toEqual([
      ["busy", 1],
      ["me", null],
    ]);
    expect(boardPlace(rows)).toEqual({ rank: null, of: 1 });
  });

  it("says where the viewer stands", () => {
    const rows = rankBoard([person("a", recap(90)), person("me", recap(60)), person("c", recap(30))], "me");
    expect(boardPlace(rows)).toEqual({ rank: 2, of: 3 });
  });
});
