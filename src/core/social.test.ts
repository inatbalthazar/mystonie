import { describe, expect, it } from "vitest";
import { nextFeedCursor, normalizePeopleQuery, parseFeedCursor, parseStamp, parseUserToggle } from "./social";

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
