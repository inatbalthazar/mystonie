import { describe, expect, it } from "vitest";
import { formatMinutes, formatRuntime } from "./runtime";

describe("formatRuntime", () => {
  it("shows hours and minutes in the locale's units", () => {
    expect(formatRuntime(156, "en")).toBe("2h 36m");
    expect(formatRuntime(45, "en")).toBe("45m");
    expect(formatRuntime(180, "en")).toBe("3h");
    expect(formatRuntime(0, "en")).toBe("0m");
    expect(formatRuntime(156, "th")).toBe("2ชม. 36นาที");
    expect(formatRuntime(156, "ko")).toBe("2시간 36분");
  });

  it("rounds to whole minutes and never goes negative", () => {
    expect(formatRuntime(59.6, "en")).toBe("1h");
    expect(formatRuntime(-5, "en")).toBe("0m");
    expect(formatRuntime(60 * 1234 + 5, "en")).toBe("1,234h 5m");
  });
});

describe("formatMinutes", () => {
  it("shows plain minutes", () => {
    expect(formatMinutes(156, "en")).toBe("156 min");
    expect(formatMinutes(156, "th")).toBe("156 นาที");
  });
});
