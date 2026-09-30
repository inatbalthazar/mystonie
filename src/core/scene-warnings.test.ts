import { describe, expect, it } from "vitest";
import { uuidv7 } from "./ids";
import {
  dtddIdFor,
  formatTimecode,
  isSceneTopic,
  NOWHERE,
  parseSceneVote,
  parseSceneWarning,
  parseTimecode,
  placeFits,
  SCENE_TOPICS,
  sceneStatus,
  sceneTopicForDtdd,
  sceneUnitsFor,
  similarWarnings,
  sortSceneWarnings,
  topicsFor,
  type SceneWarning,
} from "./scene-warnings";

const TITLE = "20000000-0000-4000-8000-0000000000a1";

describe("the topic catalogue", () => {
  it("has unique slugs and DoesTheDogDie ids, and 13 quiz topics", () => {
    expect(new Set(SCENE_TOPICS.map((t) => t.slug)).size).toBe(SCENE_TOPICS.length);
    expect(new Set(SCENE_TOPICS.map((t) => t.dtddId)).size).toBe(SCENE_TOPICS.length);
    expect(SCENE_TOPICS).toHaveLength(26);
    expect(SCENE_TOPICS.filter((t) => t.quiz)).toHaveLength(13);
    for (const t of SCENE_TOPICS) expect(t.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("maps to and from DoesTheDogDie topics", () => {
    expect(dtddIdFor("dog-dies")).toBe(153);
    expect(sceneTopicForDtdd(161)).toBe("jump-scares");
    expect(sceneTopicForDtdd(222)).toBeNull(); // "the ending is sad": DTDD only
    expect(isSceneTopic("spiders")).toBe(true);
    expect(isSceneTopic("made-up")).toBe(false);
  });

  it("keeps screen-only topics off books and manga", () => {
    expect(topicsFor("movie")).toContain("jump-scares");
    expect(topicsFor("book")).not.toContain("jump-scares");
    expect(topicsFor("manga")).not.toContain("flashing-lights");
    expect(topicsFor("book")).toContain("dog-dies");
  });

  it("gives games every topic, screen ones included (S3 games)", () => {
    expect(topicsFor("game")).toHaveLength(SCENE_TOPICS.length);
    expect(topicsFor("game")).toContain("flashing-lights");
  });
});

describe("timecodes", () => {
  it("reads what people type", () => {
    expect(parseTimecode("41:10")).toBe(2470);
    expect(parseTimecode(" 1:02:13 ")).toBe(3733);
    expect(parseTimecode("41")).toBe(2460);
    expect(parseTimecode("0:05")).toBe(5);
    expect(parseTimecode("41.10")).toBe(2470);
  });

  it("rejects the unreadable and anything a day or longer", () => {
    for (const bad of ["", "41:70", "1:61:00", "a:10", "1:2:3:4", "-5", "24:00:00", "1440"]) expect(parseTimecode(bad)).toBeNull();
  });

  it("writes times as video players do", () => {
    expect(formatTimecode(2470)).toBe("41:10");
    expect(formatTimecode(3733)).toBe("1:02:13");
    expect(formatTimecode(5)).toBe("0:05");
    expect(parseTimecode(formatTimecode(86_399))).toBe(86_399);
  });
});

describe("places", () => {
  it("fit the kind of title", () => {
    const episode = { ...NOWHERE, season: 2, episode: 5, startSec: 2470 };
    expect(placeFits("series", episode)).toBe(true);
    expect(placeFits("movie", episode)).toBe(false);
    expect(placeFits("movie", { ...NOWHERE, startSec: 60, endSec: 90 })).toBe(true);
    expect(placeFits("book", { ...NOWHERE, unit: "page", position: 12 })).toBe(true);
    expect(placeFits("manga", { ...NOWHERE, unit: "page", position: 12 })).toBe(false);
    expect(placeFits("book", { ...NOWHERE, startSec: 60 })).toBe(false);
    expect(placeFits("series", { ...NOWHERE, unit: "chapter", position: 1 })).toBe(false);
    expect(placeFits("manga", NOWHERE)).toBe(true);
    // A game's warning is about the whole game.
    expect(placeFits("game", NOWHERE)).toBe(true);
    expect(placeFits("game", { ...NOWHERE, startSec: 60 })).toBe(false);
    expect(placeFits("game", { ...NOWHERE, unit: "chapter", position: 3 })).toBe(false);
    expect(sceneUnitsFor("game")).toEqual([]);
    expect(sceneUnitsFor("book")).toEqual(["chapter", "page"]);
    expect(sceneUnitsFor("series")).toEqual([]);
  });
});

describe("parseSceneWarning", () => {
  const id = uuidv7();

  it("accepts a warning with or without a place", () => {
    expect(parseSceneWarning({ id, titleId: TITLE, topic: "dog-dies", season: 2, episode: 5, startSec: 2470, endSec: 2550 })).toEqual({
      id,
      titleId: TITLE,
      topic: "dog-dies",
      season: 2,
      episode: 5,
      startSec: 2470,
      endSec: 2550,
      unit: null,
      position: null,
    });
    expect(parseSceneWarning({ id, titleId: TITLE, topic: "self-harm", unit: "chapter", position: 12 })).toMatchObject({ unit: "chapter", position: 12 });
    expect(parseSceneWarning({ id, titleId: TITLE, topic: "spiders", season: null })).toMatchObject({ season: null, startSec: null });
  });

  it("rejects half places, backwards times and bad values", () => {
    const base = { id, titleId: TITLE, topic: "dog-dies" };
    for (const bad of [
      { ...base, id: "01926000-0000-4000-8000-000000000001" },
      { ...base, titleId: "nope" },
      { ...base, topic: "made-up" },
      { ...base, season: 2 },
      { ...base, episode: 5 },
      { ...base, endSec: 90 },
      { ...base, startSec: 90, endSec: 60 },
      { ...base, startSec: 86_400 },
      { ...base, unit: "chapter" },
      { ...base, unit: "scene", position: 1 },
      { ...base, unit: "page", position: 3, startSec: 10 },
      { ...base, unit: "page", position: 0 },
      { ...base, season: 1.5, episode: 1 },
      null,
    ]) {
      expect(parseSceneWarning(bad)).toBeNull();
    }
  });

  it("reads votes", () => {
    expect(parseSceneVote({ vote: 1 })).toBe(1);
    expect(parseSceneVote({ vote: -1 })).toBe(-1);
    expect(parseSceneVote({ vote: 0 })).toBe(0);
    expect(parseSceneVote({ vote: 2 })).toBeNull();
    expect(parseSceneVote({})).toBeNull();
  });
});

describe("the verification rule", () => {
  it("confirms at 5 confirmations with more confirmations than disputes", () => {
    expect(sceneStatus(1, 0)).toBe("pending");
    expect(sceneStatus(4, 0)).toBe("pending");
    expect(sceneStatus(5, 0)).toBe("confirmed");
    expect(sceneStatus(5, 4)).toBe("confirmed");
    expect(sceneStatus(5, 5)).toBe("disputed");
    expect(sceneStatus(1, 5)).toBe("disputed");
    expect(sceneStatus(6, 5)).toBe("confirmed");
    expect(sceneStatus(4, 4)).toBe("pending");
  });
});

const warning = (over: Partial<SceneWarning>): SceneWarning => ({
  ...NOWHERE,
  id: uuidv7(),
  topic: "dog-dies",
  status: "pending",
  confirms: 1,
  disputes: 0,
  createdAt: "2026-09-30T10:00:00.000Z",
  mine: false,
  myVote: null,
  ...over,
});

describe("lists", () => {
  it("sort in viewing order", () => {
    const whole = warning({ id: "a" });
    const s1e1 = warning({ id: "b", season: 1, episode: 1, startSec: 600 });
    const s1e1early = warning({ id: "c", season: 1, episode: 1, startSec: 60 });
    const s2e1 = warning({ id: "d", season: 2, episode: 1 });
    expect(sortSceneWarnings([s2e1, s1e1, whole, s1e1early]).map((w) => w.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("find others' warnings about the same topic and episode", () => {
    const same = warning({ season: 2, episode: 5 });
    const list = [same, warning({ season: 2, episode: 6 }), warning({ season: 2, episode: 5, mine: true }), warning({ season: 2, episode: 5, topic: "spiders" })];
    expect(similarWarnings(list, "dog-dies", { season: 2, episode: 5 })).toEqual([same]);
  });
});
