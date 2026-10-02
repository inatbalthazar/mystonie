import { describe, expect, it } from "vitest";
import { finishedInCommon } from "./in-common";
import type { StatsEntry } from "./summary";

const entry = (titleId: string, finishedAt: string | null, extra: Partial<StatsEntry> = {}): StatsEntry => ({
  id: `e-${titleId}-${finishedAt}`,
  titleId,
  status: "finished",
  finishedAt,
  ...extra,
});

describe("finishedInCommon", () => {
  it("keeps their finishes that are among mine, newest first", () => {
    const theirs = [entry("a", "2026-01-01T00:00:00Z"), entry("b", "2026-03-01T00:00:00Z"), entry("c", "2026-02-01T00:00:00Z")];
    expect(finishedInCommon(theirs, new Set(["a", "c", "z"]))).toEqual(["c", "a"]);
  });

  it("skips what they haven't finished, deleted entries, and repeats", () => {
    const theirs = [
      entry("a", null, { status: "watching" }),
      entry("b", "2026-01-01T00:00:00Z", { deletedAt: "2026-01-02T00:00:00Z" }),
      entry("c", "2026-01-01T00:00:00Z"),
      entry("c", "2026-02-01T00:00:00Z"),
    ];
    expect(finishedInCommon(theirs, new Set(["a", "b", "c"]))).toEqual(["c"]);
  });

  it("is empty when nothing is shared", () => {
    expect(finishedInCommon([entry("a", "2026-01-01T00:00:00Z")], new Set())).toEqual([]);
  });
});
