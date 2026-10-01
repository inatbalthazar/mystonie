import { describe, expect, it } from "vitest";
import { SCENE_TOPICS } from "./scene-warnings";
import { AVOID_MAX, BADGE_TITLES_MAX, badgeKey, FAMILY_TOPIC_IDS, mergeBadgeTopics, parseAvoidTopics, parseBadgeTitles, titleCheck } from "./warnings";

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

describe("titleCheck", () => {
  const dog = { id: 153, name: "a dog dies", yes: 142, no: 3 };
  const spiders = { id: 165, name: "spiders", yes: 0, no: 12 };
  const scares = { id: 161, name: "jump scares", yes: 2, no: 1 };

  it("lists the avoided topics DTDD or our own warnings say yes to, in the user's order", () => {
    expect(titleCheck([165, 153, 189], [dog, spiders], [189])).toEqual({
      verdict: "hits",
      hits: [
        { id: 153, name: "a dog dies", yes: 142, no: 3, ours: false },
        { id: 189, ours: true },
      ],
    });
    // Our own warnings count for books, manga and games too, where DTDD has nothing.
    expect(titleCheck([153], null, [153])).toEqual({ verdict: "hits", hits: [{ id: 153, ours: true }] });
  });

  it("is clear when DTDD knows the title and nothing hits, saying how sure", () => {
    expect(titleCheck([165, 161, 199], [dog, spiders, scares], [])).toEqual({ verdict: "clear", sure: 1, unsure: 2 });
    expect(titleCheck([165, 165], [spiders], [])).toEqual({ verdict: "clear", sure: 1, unsure: 0 });
  });

  it("is unknown without DTDD data or our own hits", () => {
    expect(titleCheck([153], null, [])).toEqual({ verdict: "unknown" });
  });
});

describe("FAMILY_TOPIC_IDS", () => {
  it("uses our own topics, so every kind can answer them", () => {
    const ours = new Set<number>(SCENE_TOPICS.map((t) => t.dtddId));
    expect(FAMILY_TOPIC_IDS.length).toBeGreaterThan(5);
    expect(FAMILY_TOPIC_IDS.every((id) => ours.has(id))).toBe(true);
    expect(parseAvoidTopics({ topicIds: FAMILY_TOPIC_IDS })).toEqual([...FAMILY_TOPIC_IDS]);
  });
});
