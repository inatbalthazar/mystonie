import { describe, expect, it } from "vitest";
import { isOfficial, mascotCheer } from "./official";

describe("isOfficial", () => {
  it("knows the two labels", () => {
    expect(isOfficial("mascot")).toBe(true);
    expect(isOfficial("team")).toBe(true);
    expect(isOfficial("admin")).toBe(false);
    expect(isOfficial(null)).toBe(false);
  });
});

describe("mascotCheer (ADR 0098)", () => {
  it("calls the very first finish a first finish, not a first movie", () => {
    expect(mascotCheer(["first:movie", "finishes:1"])).toEqual({ type: "count", count: 1 });
  });

  it("tells the biggest count", () => {
    expect(mascotCheer(["finishes:1", "finishes:10", "finishes:25"])).toEqual({ type: "count", count: 25 });
    expect(mascotCheer(["first:book", "finishes:10"])).toEqual({ type: "count", count: 10 });
  });

  it("tells the first of a kind", () => {
    expect(mascotCheer(["first:book"])).toEqual({ type: "first", kind: "book" });
  });

  it("ignores what it doesn't know", () => {
    expect(mascotCheer([])).toBeNull();
    expect(mascotCheer(["first:podcast", "finishes:x"])).toBeNull();
  });
});
