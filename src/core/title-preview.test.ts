import { describe, expect, it } from "vitest";
import type { TopicVotes } from "./catalog/dtdd";
import { creditNames, flaggedTopics, imdbUrl, OVERVIEW_MAX, tmdbFacts } from "./title-preview";

describe("tmdbFacts", () => {
  it("reads a movie's synopsis, score and IMDb id", () => {
    expect(
      tmdbFacts({ overview: "  A poor family\nschemes.  ", tagline: "Act like you own the place.", vote_average: 8.512, vote_count: 18234, imdb_id: "tt6751668" }),
    ).toEqual({ overview: "A poor family schemes.", tagline: "Act like you own the place.", score: 8.5, votes: 18234, imdbId: "tt6751668" });
  });

  it("finds a series' IMDb id under external_ids", () => {
    expect(tmdbFacts({ external_ids: { imdb_id: "tt0903747" } }).imdbId).toBe("tt0903747");
  });

  it("has no score without votes, and drops anything odd", () => {
    expect(tmdbFacts({ overview: "", tagline: 3, vote_average: 0, vote_count: 0, imdb_id: "javascript:alert(1)" })).toEqual({
      overview: null,
      tagline: null,
      score: null,
      votes: null,
      imdbId: null,
    });
    expect(tmdbFacts({ vote_average: 11, vote_count: 5 }).score).toBeNull();
    expect(tmdbFacts(null).overview).toBeNull();
    expect(tmdbFacts([]).imdbId).toBeNull();
  });

  it("cuts a very long synopsis at a word", () => {
    const overview = tmdbFacts({ overview: "word ".repeat(400) }).overview!;
    expect([...overview].length).toBeLessThanOrEqual(OVERVIEW_MAX + 1);
    expect(overview).toMatch(/word…$/);
  });
});

describe("imdbUrl", () => {
  it("links to the title page", () => {
    expect(imdbUrl("tt6751668")).toBe("https://www.imdb.com/title/tt6751668/");
  });
});

const topic = (id: number, name: string, yes: number, no: number, spoiler = false): TopicVotes => ({
  id,
  name,
  category: "Test",
  spoiler,
  yes,
  no,
  comment: null,
});

describe("flaggedTopics", () => {
  it("lists Yes topics by votes, keeps spoilers out of the list but counts them", () => {
    const topics = [
      topic(1, "there are jump scares", 12, 2),
      topic(2, "a dog dies", 142, 3),
      topic(3, "the ending is sad", 40, 2, true),
      topic(4, "there are spiders", 1, 30),
      topic(5, "someone is sick", 2, 0),
    ];
    expect(flaggedTopics(topics)).toEqual({
      flagged: [
        { id: 2, name: "a dog dies", yes: 142, no: 3 },
        { id: 1, name: "there are jump scares", yes: 12, no: 2 },
      ],
      more: 1,
    });
  });

  it("shows at most `max`", () => {
    const topics = Array.from({ length: 5 }, (_, i) => topic(i, `topic ${i}`, 10 + i, 0));
    const { flagged, more } = flaggedTopics(topics, 3);
    expect(flagged.map((t) => t.id)).toEqual([4, 3, 2]);
    expect(more).toBe(2);
  });
});

describe("creditNames", () => {
  it("keeps one role, in order", () => {
    const credits = [
      { role: "actor" as const, id: "1", name: "Song Kang-ho", image: null },
      { role: "director" as const, id: "2", name: "Bong Joon-ho", image: null },
      { role: "actor" as const, id: "3", name: "Choi Woo-shik", image: null },
    ];
    expect(creditNames(credits, "actor")).toEqual(["Song Kang-ho", "Choi Woo-shik"]);
    expect(creditNames(null, "director")).toEqual([]);
  });
});
