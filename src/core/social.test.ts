import { describe, expect, it } from "vitest";
import { nextFeedCursor, normalizePeopleQuery, parseFeedCursor, parseStamp, parseUserToggle, suggestionReason } from "./social";

const id = "01926000-0000-7000-8000-0000000000A1";

describe("parseUserToggle", () => {
  it("reads a follow or a block", () => {
    expect(parseUserToggle({ userId: id, follow: true }, "follow")).toEqual({ userId: id.toLowerCase(), on: true });
    expect(parseUserToggle({ userId: id, block: false }, "block")).toEqual({ userId: id.toLowerCase(), on: false });
  });

  it.each([null, [], { userId: id }, { userId: "nope", follow: true }, { userId: id, follow: "yes" }, { userId: id, block: true }])(
    "rejects %j",
    (body) => {
      expect(parseUserToggle(body, "follow")).toBeNull();
    },
  );
});

describe("parseStamp", () => {
  it("reads a stamp", () => {
    expect(parseStamp({ entryId: id, stamped: true })).toEqual({ entryId: id.toLowerCase(), stamped: true });
  });

  it.each([null, { entryId: id }, { entryId: 1, stamped: true }, { entryId: id, stamped: 1 }])("rejects %j", (body) => {
    expect(parseStamp(body)).toBeNull();
  });
});

describe("parseFeedCursor", () => {
  it("is null for the first page", () => {
    expect(parseFeedCursor(new URLSearchParams())).toBeNull();
  });

  it("normalizes the time", () => {
    expect(parseFeedCursor(new URLSearchParams({ before: "2026-09-02T17:00:00+07:00", id }))).toEqual({
      before: "2026-09-02T10:00:00.000Z",
      id: id.toLowerCase(),
    });
  });

  it.each<Record<string, string>>([{ before: "2026-09-02T10:00:00Z" }, { id }, { before: "yesterday", id }, { before: "2026-09-02", id: "x" }])(
    "rejects %j",
    (params) => {
      expect(parseFeedCursor(new URLSearchParams(params))).toBe("invalid");
    },
  );
});

describe("nextFeedCursor", () => {
  const items = [
    { finishedAt: "2026-09-03T00:00:00.000Z", entryId: "a" },
    { finishedAt: "2026-09-02T00:00:00.000Z", entryId: "b" },
  ];

  it("points after the last item of a full page", () => {
    expect(nextFeedCursor(items, 2)).toEqual({ before: "2026-09-02T00:00:00.000Z", id: "b" });
  });

  it("is null when the page wasn't full", () => {
    expect(nextFeedCursor(items, 3)).toBeNull();
    expect(nextFeedCursor([], 3)).toBeNull();
  });
});

describe("normalizePeopleQuery", () => {
  it("tidies what was typed", () => {
    expect(normalizePeopleQuery("  @Kim   Lee ")).toBe("kim lee");
    expect(normalizePeopleQuery("ＫＩＭ")).toBe("kim");
  });

  it("needs 2 to 50 characters", () => {
    expect(normalizePeopleQuery("@k")).toBeNull();
    expect(normalizePeopleQuery(null)).toBeNull();
    expect(normalizePeopleQuery("k".repeat(51))).toBeNull();
    expect(normalizePeopleQuery("김민")).toBe("김민");
  });
});

describe("suggestionReason", () => {
  const none = { finished: 0, shared: 0, sharedTitle: null, mutuals: 0, club: null, country: null };
  it("picks the strongest reason", () => {
    expect(suggestionReason({ ...none, mutuals: 3, shared: 5, sharedTitle: "Dune" })).toEqual({ kind: "mutuals", count: 3 });
    expect(suggestionReason({ ...none, mutuals: 1, shared: 5, sharedTitle: "Dune", club: "horror" })).toEqual({ kind: "shared", count: 5, title: "Dune" });
    expect(suggestionReason({ ...none, mutuals: 1, club: "horror", country: "TH" })).toEqual({ kind: "club", club: "horror" });
    expect(suggestionReason({ ...none, mutuals: 1, country: "TH" })).toEqual({ kind: "country", country: "TH" });
    expect(suggestionReason({ ...none, mutuals: 1 })).toEqual({ kind: "mutuals", count: 1 });
  });
  it("falls back to how much they finish", () => {
    expect(suggestionReason({ ...none, finished: 12 })).toEqual({ kind: "active", finished: 12 });
    // A shared title without its name (not expected) is not a reason on its own.
    expect(suggestionReason({ ...none, shared: 2, finished: 4 })).toEqual({ kind: "active", finished: 4 });
  });
});
