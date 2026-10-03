import { describe, expect, it } from "vitest";
import { parseQuizAnswer, parseQuizResult, parseQuizServe, parseQuizTitle } from "./quiz";

const ANSWER = "01926000-0000-7000-8000-000000000001";
const TITLE = { id: "20000000-0000-4000-8000-0000000000a1", kind: "series", source: "tmdb", externalId: "66732", name: "Stranger Things", year: 2016, posterPath: "/x.jpg" };

describe("parseQuizServe", () => {
  it("reads a topic question, with the poster URL", () => {
    expect(parseQuizServe({ status: "question", id: ANSWER, kind: "topic", topic: "jump-scares", title: TITLE, where: null, answers: 3 })).toEqual({
      status: "question",
      id: ANSWER,
      kind: "topic",
      topic: "jump-scares",
      title: { id: TITLE.id, kind: "series", externalId: "66732", name: "Stranger Things", year: 2016, posterUrl: "https://image.tmdb.org/t/p/w342/x.jpg" },
      where: null,
      answers: 3,
      avoiders: 0,
    });
  });

  it("reads a warning question with its place", () => {
    const served = parseQuizServe({
      status: "question",
      id: ANSWER,
      kind: "warning",
      topic: "dog-dies",
      title: { ...TITLE, posterPath: null },
      where: { season: 2, episode: 5, startSec: 2470, endSec: null, unit: null, position: null },
      answers: 2,
    });
    expect(served).toMatchObject({ kind: "warning", where: { season: 2, episode: 5, startSec: 2470, endSec: null }, title: { posterUrl: null } });
  });

  it("reads the other states", () => {
    expect(parseQuizServe({ status: "no_finishes" })).toEqual({ status: "no_finishes" });
    expect(parseQuizServe({ status: "done" })).toEqual({ status: "done" });
    expect(parseQuizServe({ status: "paused", until: "2026-09-30T12:00:00.5+00:00" })).toEqual({ status: "paused", until: "2026-09-30T12:00:00.500Z" });
  });

  it("refuses what it can't show", () => {
    expect(parseQuizServe({ status: "question", id: ANSWER, kind: "topic", topic: "unknown-topic", title: TITLE, answers: 0 })).toBeNull();
    expect(parseQuizServe({ status: "question", id: ANSWER, kind: "topic", topic: "spiders", title: { ...TITLE, kind: "podcast" }, answers: 0 })).toBeNull();
    expect(parseQuizServe({ status: "question", id: "nope", kind: "topic", topic: "spiders", title: TITLE })).toBeNull();
    expect(parseQuizServe({ status: "paused" })).toBeNull();
    expect(parseQuizServe(null)).toBeNull();
  });
});

describe("parseQuizResult", () => {
  it("reads a counted answer and the other outcomes", () => {
    expect(parseQuizResult({ status: "counted", kind: "topic", result: "yes", yes: 6, no: 4, confirms: null, disputes: null })).toEqual({
      status: "counted",
      kind: "topic",
      result: "yes",
      yes: 6,
      no: 4,
      confirms: null,
    });
    expect(parseQuizResult({ status: "not_counted", kind: "warning", result: "pending", confirms: 2 })).toMatchObject({ result: "pending", confirms: 2 });
    expect(parseQuizResult({ status: "too_fast" })).toEqual({ status: "too_fast" });
    expect(parseQuizResult({ status: "paused", until: "2026-09-30T12:00:00Z" })).toEqual({ status: "paused", until: "2026-09-30T12:00:00.000Z" });
    expect(parseQuizResult({ status: "gone" })).toEqual({ status: "gone" });
    expect(parseQuizResult({ status: "other" })).toBeNull();
  });
});

describe("requests", () => {
  it("read an answer", () => {
    expect(parseQuizAnswer({ id: ANSWER, choice: "unsure" })).toEqual({ id: ANSWER, choice: "unsure" });
    expect(parseQuizAnswer({ id: ANSWER, choice: "maybe" })).toBeNull();
    expect(parseQuizAnswer({ id: "1", choice: "yes" })).toBeNull();
  });

  it("read the title to ask about first", () => {
    expect(parseQuizTitle(TITLE.id.toUpperCase())).toBe(TITLE.id);
    expect(parseQuizTitle(["x"])).toBeNull();
    expect(parseQuizTitle(undefined)).toBeNull();
  });
});
