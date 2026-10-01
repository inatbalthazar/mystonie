import { describe, expect, it } from "vitest";
import { feedbackEmail } from "./email/feedback";
import { FEEDBACK_MESSAGE_MAX, feedbackDevice, feedbackPage, parseFeedback } from "./feedback";

describe("parseFeedback", () => {
  it("accepts a report and tidies it", () => {
    expect(parseFeedback({ kind: "bug", message: "  The ➕ does nothing \n", page: "/th/collection?add=1", errorRef: "abc123" })).toEqual({
      kind: "ok",
      feedback: { kind: "bug", message: "The ➕ does nothing", page: "/th/collection", errorRef: "abc123" },
    });
  });

  it("treats a filled honeypot as a bot", () => {
    expect(parseFeedback({ kind: "idea", message: "hi", website: "spam.example" })).toEqual({ kind: "bot" });
  });

  it("refuses a missing kind, an empty or too long message", () => {
    expect(parseFeedback(null).kind).toBe("invalid");
    expect(parseFeedback({ kind: "praise", message: "hi" }).kind).toBe("invalid");
    expect(parseFeedback({ kind: "bug", message: "   " }).kind).toBe("invalid");
    expect(parseFeedback({ kind: "bug", message: 42 }).kind).toBe("invalid");
    expect(parseFeedback({ kind: "bug", message: "x".repeat(FEEDBACK_MESSAGE_MAX + 1) }).kind).toBe("invalid");
    // Counted in characters, not UTF-16 units.
    expect(parseFeedback({ kind: "bug", message: "🙂".repeat(FEEDBACK_MESSAGE_MAX) }).kind).toBe("ok");
  });

  it("drops a page or error ref it can't trust instead of refusing the report", () => {
    const parsed = parseFeedback({ kind: "other", message: "hi", page: "https://evil.example/", errorRef: "<script>" });
    expect(parsed).toEqual({ kind: "ok", feedback: { kind: "other", message: "hi", page: null, errorRef: null } });
  });
});

describe("feedbackPage", () => {
  it("keeps the path only", () => {
    expect(feedbackPage("/unsubscribe?token=secret#x")).toBe("/unsubscribe");
    expect(feedbackPage("/")).toBe("/");
  });

  it("refuses anything that isn't a path on this site", () => {
    for (const from of ["//evil.example", "/\\evil.example", "https://x.example/", "home", "/a b", "/a\nb", `/${"a".repeat(300)}`, 7, null]) {
      expect(feedbackPage(from)).toBeNull();
    }
  });
});

describe("feedbackDevice", () => {
  it("trims and cuts the user agent", () => {
    expect(feedbackDevice(" Mozilla/5.0 ")).toBe("Mozilla/5.0");
    expect(feedbackDevice("x".repeat(400))).toHaveLength(300);
    expect(feedbackDevice("  ")).toBeNull();
    expect(feedbackDevice(null)).toBeNull();
  });
});

describe("feedbackEmail", () => {
  const id = "01926000-0000-7000-8000-0000000000f1";

  it("tells the operator what, where and who", () => {
    const email = feedbackEmail(
      { id, kind: "bug", message: "Cards won't download on my phone\nSafari, every time", page: "/c/1", errorRef: "d1" },
      { userId: "u1", email: "kim@example.com", device: "iPhone Safari", locale: "th" },
      "https://mystonie.app/c/1",
    );
    expect(email.subject).toBe("Beta bug: Cards won't download on my phone");
    expect(email.text).toContain("Page: https://mystonie.app/c/1");
    expect(email.text).toContain("Error digest: d1");
    expect(email.text).toContain("From: kim@example.com (u1)");
    expect(email.text).toContain(`where id = '${id}'`);
  });

  it("shortens a long first line and escapes the HTML", () => {
    const email = feedbackEmail(
      { id, kind: "idea", message: `<b>${"a".repeat(80)}</b>`, page: null, errorRef: null },
      { userId: null, email: null, device: null, locale: "en" },
      null,
    );
    expect(email.subject).toMatch(/^Beta idea: <b>a{57}…$/);
    expect(email.text).toContain("From: (signed out)");
    expect(email.html).not.toContain("<b>");
  });
});
