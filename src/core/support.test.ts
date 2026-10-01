import { describe, expect, it } from "vitest";
import { normalEmail, parseTipEvent } from "./support";

const NOW = Date.parse("2026-10-01T12:00:00Z");

describe("normalEmail", () => {
  it("trims and lowercases a plausible email", () => {
    expect(normalEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });

  it("refuses anything else", () => {
    for (const raw of ["", "sam", "sam@", "@example.com", "sam @example.com", 5, null, `${"a".repeat(320)}@x.co`])
      expect(normalEmail(raw)).toBeNull();
  });
});

describe("parseTipEvent", () => {
  const event = (type: string, data: unknown, created: unknown = 1_790_000_000) => ({
    event_id: 1,
    type,
    live_mode: true,
    created,
    attempt: 1,
    data,
  });

  it("reads a tip or a membership's email and time", () => {
    expect(parseTipEvent(event("donation.created", { supporter_email: "Sam@Example.com", amount: 5 }), NOW)).toEqual({
      email: "sam@example.com",
      at: 1_790_000_000_000,
    });
    expect(parseTipEvent(event("membership.started", { supporter_email: "kim@example.com" }), NOW)?.email).toBe("kim@example.com");
  });

  it("dates a tip now when its time is missing or ahead", () => {
    expect(parseTipEvent(event("donation.created", { supporter_email: "sam@example.com" }, null), NOW)?.at).toBe(NOW);
    expect(parseTipEvent(event("donation.created", { supporter_email: "sam@example.com" }, NOW / 1000 + 3600), NOW)?.at).toBe(NOW);
  });

  it("ignores other events and tips without an email", () => {
    expect(parseTipEvent(event("donation.refunded", { supporter_email: "sam@example.com" }), NOW)).toBeNull();
    expect(parseTipEvent(event("donation.created", { supporter_name: "Someone" }), NOW)).toBeNull();
    expect(parseTipEvent(event("donation.created", null), NOW)).toBeNull();
    expect(parseTipEvent("donation.created", NOW)).toBeNull();
  });
});
