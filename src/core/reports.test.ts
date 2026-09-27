import { describe, expect, it } from "vitest";
import { reportEmail } from "./email/report";
import { parseReport } from "./reports";

const card = "01926000-0000-7000-8000-0000000000A1";

describe("parseReport", () => {
  it("accepts a report and tidies it", () => {
    expect(parseReport({ targetKind: "card", targetId: card, reason: "spam", note: "  same card every hour " })).toEqual({
      kind: "ok",
      report: { targetKind: "card", targetId: card.toLowerCase(), reason: "spam", note: "same card every hour" },
    });
  });

  it("makes an empty note null", () => {
    const parsed = parseReport({ targetKind: "profile", targetId: card, reason: "other", note: "  " });
    expect(parsed.kind === "ok" && parsed.report.note).toBeNull();
  });

  it("treats a filled honeypot as a bot", () => {
    expect(parseReport({ targetKind: "card", targetId: card, reason: "spam", website: "x" })).toEqual({ kind: "bot" });
  });

  it.each([
    [null],
    [{ targetKind: "entry", targetId: card, reason: "spam" }],
    [{ targetKind: "card", targetId: "not-a-uuid", reason: "spam" }],
    [{ targetKind: "card", targetId: card, reason: "boring" }],
    [{ targetKind: "card", targetId: card, reason: "spam", note: 42 }],
    [{ targetKind: "card", targetId: card, reason: "spam", note: "x".repeat(501) }],
  ])("rejects %j", (body) => {
    expect(parseReport(body)).toEqual({ kind: "invalid" });
  });
});

describe("reportEmail", () => {
  it("escapes the reporter's note in the HTML part", () => {
    const email = reportEmail(
      { id: "r1", targetKind: "profile", targetId: card, reason: "harassment", note: "<b>mean</b>" },
      "https://mystonie.app/u/someone",
    );
    expect(email.subject).toBe("Report: profile (harassment)");
    expect(email.text).toContain("Note: <b>mean</b>");
    expect(email.html).toContain("&lt;b&gt;mean&lt;/b&gt;");
    expect(email.html).not.toContain("<b>");
  });
});
