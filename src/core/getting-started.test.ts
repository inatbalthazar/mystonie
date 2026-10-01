import { describe, expect, it } from "vitest";
import { gettingStarted } from "./getting-started";

const none = { entries: 0, cards: 0, avoidTopics: 0, following: 0, clubs: 0, installed: false };

describe("gettingStarted", () => {
  it("starts empty, in the order the steps are done", () => {
    const g = gettingStarted(none);
    expect(g.steps.map((s) => s.step)).toEqual(["add", "card", "topics", "social", "install"]);
    expect(g).toMatchObject({ done: 0, total: 5, percent: 0, complete: false });
  });

  it("ticks each step from real data; following someone or joining a club both count", () => {
    const g = gettingStarted({ ...none, entries: 3, clubs: 1 });
    expect(g.steps.filter((s) => s.done).map((s) => s.step)).toEqual(["add", "social"]);
    expect(g.percent).toBe(40);
    expect(gettingStarted({ ...none, following: 2 }).steps.find((s) => s.step === "social")!.done).toBe(true);
  });

  it("is complete with all five", () => {
    expect(gettingStarted({ entries: 1, cards: 1, avoidTopics: 12, following: 1, clubs: 0, installed: true })).toMatchObject({ done: 5, percent: 100, complete: true });
  });
});
