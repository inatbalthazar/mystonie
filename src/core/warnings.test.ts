import { describe, expect, it } from "vitest";
import { AVOID_MAX, BADGE_TITLES_MAX, badgeKey, mergeBadgeTopics, parseAvoidTopics, parseBadgeTitles } from "./warnings";

describe("parseAvoidTopics", () => {
  it("accepts topic ids, deduplicated", () => {
    expect(parseAvoidTopics({ topicIds: [153, 161, 153] })).toEqual([153, 161]);
    expect(parseAvoidTopics({ topicIds: [] })).toEqual([]);
  });

  it("rejects anything else", () => {
    expect(parseAvoidTopics(null)).toBeNull();
    expect(parseAvoidTopics({ topicIds: "153" })).toBeNull();
    expect(parseAvoidTopics({ topicIds: [0] })).toBeNull();
    expect(parseAvoidTopics({ topicIds: [1.5] })).toBeNull();
    expect(parseAvoidTopics({ topicIds: ["153"] })).toBeNull();
    expect(parseAvoidTopics({ topicIds: Array.from({ length: AVOID_MAX + 1 }, (_, i) => i + 1) })).toBeNull();
  });
});

describe("parseBadgeTitles", () => {
  it("accepts every kind with its catalog's ids", () => {
    const titles = parseBadgeTitles({
      titles: [
        { kind: "movie", externalId: "245891" },
        { kind: "series", externalId: "66732" },
        { kind: "book", externalId: "zyTCAlFPjgYC" },
        { kind: "manga", externalId: "30013" },
        { kind: "game", externalId: "3328" },
      ],
    });
    expect(titles?.map(badgeKey)).toEqual(["movie:245891", "series:66732", "book:zyTCAlFPjgYC", "manga:30013", "game:3328"]);
  });

  it("rejects bad kinds and ids, and long lists", () => {
    expect(parseBadgeTitles({ titles: [{ kind: "book", externalId: "abc" }] })).toBeNull();
    expect(parseBadgeTitles({ titles: [{ kind: "podcast", externalId: "1" }] })).toBeNull();
    expect(parseBadgeTitles({ titles: [{ kind: "movie", externalId: "12a" }] })).toBeNull();
    expect(parseBadgeTitles({ titles: Array.from({ length: BADGE_TITLES_MAX + 1 }, () => ({ kind: "movie", externalId: "1" })) })).toBeNull();
    expect(parseBadgeTitles({})).toBeNull();
  });
});

describe("mergeBadgeTopics", () => {
  it("keeps one per topic, DTDD's names first, then ours by id", () => {
    expect(mergeBadgeTopics([{ id: 153, name: "a dog dies" }, { id: 161, name: "there are jump scares" }], [165, 153])).toEqual([
      { id: 153, name: "a dog dies" },
      { id: 161, name: "there are jump scares" },
      { id: 165 },
    ]);
    expect(mergeBadgeTopics([], [])).toEqual([]);
  });
});
