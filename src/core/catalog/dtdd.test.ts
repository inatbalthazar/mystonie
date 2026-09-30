import { describe, expect, it } from "vitest";
import {
  avoidHits,
  matchDtddItem,
  matchName,
  normalizeDtddMedia,
  normalizeDtddSearch,
  normalizeDtddTopics,
  survivedTopic,
  warningVerdict,
  type DtddItem,
  type WarningTitle,
} from "./dtdd";
import categories from "./fixtures/dtdd-categories.json";
import media from "./fixtures/dtdd-media-15713.json";
import search from "./fixtures/dtdd-search-john-wick.json";

const johnWick: WarningTitle = { kind: "movie", externalId: "245891", name: "John Wick", originalName: null, year: 2014, imdbId: null };

describe("warningVerdict", () => {
  it("needs 3 votes and a majority", () => {
    expect(warningVerdict(142, 3)).toBe("yes");
    expect(warningVerdict(3, 0)).toBe("yes");
    expect(warningVerdict(2, 0)).toBe("unclear");
    expect(warningVerdict(5, 5)).toBe("unclear");
    expect(warningVerdict(1, 30)).toBe("no");
    expect(warningVerdict(0, 2)).toBe("unclear");
    expect(warningVerdict(0, 0)).toBe("unclear");
  });
});

describe("normalizeDtddSearch", () => {
  it("keeps ids, years and types", () => {
    const items = normalizeDtddSearch(search);
    expect(items[0]).toEqual({ id: 15713, name: "John Wick", year: 2014, type: "movie", tmdbId: 245891, imdbId: "tt2911666" });
    expect(items.find((i) => i.type === "series")).toMatchObject({ name: "The Continental: From the World of John Wick", tmdbId: 72710 });
  });

  it("drops junk", () => {
    expect(normalizeDtddSearch(null)).toEqual([]);
    expect(normalizeDtddSearch({ items: [{ id: -1, name: "x" }, { id: 2 }, { id: 3, name: "Ok", releaseYear: "Unknown", tmdbid: "12" }] })).toEqual([
      { id: 3, name: "Ok", year: null, type: "other", tmdbId: 12, imdbId: null },
    ]);
  });
});

describe("normalizeDtddMedia", () => {
  it("keeps topics with votes, with their category, spoiler flag and top comment", () => {
    const topics = normalizeDtddMedia(media);
    expect(topics.find((t) => t.id === 153)).toMatchObject({
      name: "a dog dies",
      category: "Animal Death",
      spoiler: false,
      yes: 1374,
      no: 131,
      comment: expect.stringMatching(/^Yes, and it's terrible/),
    });
    // "it's told from an abuser's point of view" has no votes at all.
    expect(topics.some((t) => t.id === 462)).toBe(false);
    expect(topics.find((t) => t.id === 222)?.spoiler).toBe(true);
  });

  it("drops hidden topics and caps comments", () => {
    const body = {
      topicItemStats: [
        { TopicId: 1, yesSum: 4, noSum: 0, topic: { id: 1, name: "hidden", isVisible: false } },
        { TopicId: 2, yesSum: 4, noSum: 0, comment: "x".repeat(900), topic: { id: 2, name: "  spaced   out " } },
        { TopicId: 3, yesSum: 4, noSum: 0, topic: { id: 4, name: "id mismatch" } },
      ],
    };
    const topics = normalizeDtddMedia(body);
    expect(topics.map((t) => [t.id, t.name, t.category])).toEqual([[2, "spaced out", "Other"]]);
    expect(topics[0]!.comment).toHaveLength(500);
  });
});

describe("normalizeDtddTopics", () => {
  it("sorts by category, then name", () => {
    const topics = normalizeDtddTopics(categories);
    expect(topics.length).toBe(8);
    expect(topics[0]).toEqual({ id: 462, name: "it's told from an abuser's point of view", category: "Abuse", spoiler: false });
    const cats = topics.map((t) => t.category);
    expect(cats).toEqual([...cats].sort((a, b) => a.localeCompare(b, "en")));
  });
});

describe("matchDtddItem", () => {
  const items = normalizeDtddSearch(search);

  it("matches by TMDB id and type", () => {
    expect(matchDtddItem(items, johnWick)?.id).toBe(15713);
    expect(matchDtddItem(items, { ...johnWick, externalId: "72710" })).toBeNull(); // that id is a series on DTDD
    expect(matchDtddItem(items, { ...johnWick, kind: "series", externalId: "72710", name: "The Continental" })?.id).toBe(1652075);
  });

  it("matches by IMDb id when the TMDB id differs", () => {
    expect(matchDtddItem(items, { ...johnWick, externalId: "1", imdbId: "tt2911666" })?.id).toBe(15713);
  });

  it("falls back to the one same-name, same-year item without a TMDB id", () => {
    const loose: DtddItem[] = [
      { id: 1, name: "The Host", year: 2006, type: "movie", tmdbId: null, imdbId: null },
      { id: 2, name: "The Host", year: 2013, type: "movie", tmdbId: null, imdbId: null },
      { id: 3, name: "Host", year: 2006, type: "series", tmdbId: null, imdbId: null },
    ];
    const host: WarningTitle = { kind: "movie", externalId: "1255", name: "Host", originalName: "괴물", year: 2006, imdbId: null };
    expect(matchDtddItem(loose, host)?.id).toBe(1);
    expect(matchDtddItem(loose, { ...host, year: null })).toBeNull();
    // Two candidates: ambiguous, so no match.
    expect(matchDtddItem([...loose, { ...loose[0]!, id: 9 }], host)).toBeNull();
    // An item tied to another TMDB title is someone else's.
    expect(matchDtddItem([{ ...loose[0]!, tmdbId: 99 }], host)).toBeNull();
  });

  it("normalizes names", () => {
    expect(matchName("The Office")).toBe("office");
    expect(matchName("Amélie")).toBe("amelie");
    expect(matchName("Fast & Furious")).toBe("fast and furious");
  });
});

describe("avoidHits and survivedTopic", () => {
  const topics = normalizeDtddMedia(media);

  it("lists the avoid-topics with a Yes, in the user's order", () => {
    // a dog dies (1374/131) yes; a cat dies (26/212) no; spiders (4/128) no; an animal dies (298/71) yes.
    expect(avoidHits(topics, [186, 189, 153, 165]).map((t) => t.id)).toEqual([189, 153]);
    expect(avoidHits(topics, [])).toEqual([]);
  });

  it("finds the first scare with a Yes", () => {
    expect(survivedTopic(topics)).toBe("gore");
    expect(survivedTopic([{ id: 165, yes: 9, no: 1 }, { id: 161, yes: 3, no: 1 }])).toBe("jumpScares");
    expect(survivedTopic([{ id: 161, yes: 2, no: 0 }])).toBeNull();
  });
});
