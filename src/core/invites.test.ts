import { describe, expect, it } from "vitest";
import { INVITE_DAYS, invitePath, parseInvite, storedInvite, storeInvite } from "./invites";

const NOW = Date.parse("2026-10-06T12:00:00Z");

describe("invites (ADR 0098)", () => {
  it("links to the join page", () => {
    expect(invitePath("kim_1")).toBe("/join/kim_1");
  });

  it("remembers an invite for a week", () => {
    const raw = storeInvite("kim_1", NOW);
    expect(storedInvite(raw, NOW + 86_400_000)).toBe("kim_1");
    expect(storedInvite(raw, NOW + INVITE_DAYS * 86_400_000 + 1)).toBeNull();
  });

  it("forgets broken or odd invites", () => {
    expect(storedInvite(null, NOW)).toBeNull();
    expect(storedInvite("{", NOW)).toBeNull();
    expect(storedInvite(JSON.stringify({ username: "a b", at: NOW }), NOW)).toBeNull();
    expect(storedInvite(JSON.stringify({ username: "kim_1", at: NOW + 3_600_000 }), NOW)).toBeNull();
  });

  it("parses the accept request", () => {
    expect(parseInvite({ username: " Kim_1 " })).toBe("kim_1");
    expect(parseInvite({ username: "x" })).toBeNull();
    expect(parseInvite("kim_1")).toBeNull();
  });
});
