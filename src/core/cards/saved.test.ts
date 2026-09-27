import { describe, expect, it } from "vitest";
import { cardImagePath, crossedMilestone, parseCardData, parseCardSave, parseRecap } from "./saved";
import { templateFits, templatesFor } from "./templates";

const ID = "01926000-0000-7000-8000-000000000001";
const ENTRY = "01926000-0000-7000-8000-000000000002";
const LOG = "01926000-0000-7000-8000-000000000003";
const RECAP = "01926000-0000-7000-8000-000000000004";

const recap = {
  from: "2026-09-21",
  to: "2026-09-27",
  minutes: 583,
  episodes: 9,
  finished: 1,
  titleCount: 2,
  titles: [
    { name: "Stranger Things", kind: "series", posterUrl: "https://image.tmdb.org/t/p/w342/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg" },
    { name: "Parasite", kind: "movie", posterUrl: null },
  ],
};

const data = {
  kind: "movie",
  name: "  Parasite ",
  year: 2019,
  posterUrl: "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
  genres: ["Comedy", "Thriller"],
  runtimeMin: 133,
  rating: 4.5,
  review: "계단 장면!",
  finishedOn: "2026-09-27",
  hide: ["username", "username"],
  username: "someone_else",
};

const progress = { season: 1, episode: 8, watched: 8, total: 16, watchedMin: 400, milestone: 50 };

describe("crossedMilestone", () => {
  it("finds the milestone a log crosses", () => {
    expect(crossedMilestone(7, 8, 16)).toBe(50);
    expect(crossedMilestone(3, 4, 16)).toBe(25);
    expect(crossedMilestone(8, 9, 16)).toBeNull();
    expect(crossedMilestone(11, 12, 16)).toBe(75);
  });

  it("takes the highest when one log (a whole season) crosses several", () => {
    expect(crossedMilestone(0, 12, 16)).toBe(75);
  });

  it("ignores un-logging and empty series", () => {
    expect(crossedMilestone(8, 7, 16)).toBeNull();
    expect(crossedMilestone(0, 1, 0)).toBeNull();
    expect(crossedMilestone(0, 1, 1)).toBe(75);
  });
});

describe("parseCardData", () => {
  it("keeps valid inputs, trims, dedupes hide, and drops the username", () => {
    const parsed = parseCardData(data)!;
    expect(parsed.name).toBe("Parasite");
    expect(parsed.hide).toEqual(["username"]);
    expect(parsed).not.toHaveProperty("username");
    expect(parsed.progress).toBeNull();
    expect(parseCardData({ kind: "movie", name: "M", finishedOn: "2026-09-26" })).toMatchObject({ posterUrl: null, genres: [], hide: [] });
  });

  it("rejects bad inputs", () => {
    const bad = [
      { ...data, kind: "book" },
      { ...data, name: " " },
      { ...data, finishedOn: "2026-13-01" },
      { ...data, posterUrl: "https://evil.example/x.jpg" },
      { ...data, posterUrl: "https://image.tmdb.org/t/p/w342/../x.jpg" },
      { ...data, rating: 4.25 },
      { ...data, review: "x".repeat(81) },
      { ...data, hide: ["rating"] },
      { ...data, genres: ["a", "b", "c", "d", "e", "f"] },
      { ...data, progress: { ...progress, watched: 17 } },
      { ...data, progress: { ...progress, milestone: 60 } },
    ];
    for (const b of bad) expect(parseCardData(b), JSON.stringify(b)).toBeNull();
  });
});

describe("parseCardSave", () => {
  const finish = { id: ID, kind: "finish", templateId: "ticket", size: "story", entryId: ENTRY, data, share: true };

  it("accepts a finish card, a progress card and a sticker", () => {
    expect(parseCardSave(finish)).toMatchObject({ kind: "finish", entryId: ENTRY, episodeLogId: null, share: true });
    const series = { ...data, kind: "series", progress };
    expect(parseCardSave({ ...finish, kind: "progress", templateId: "boldStats", entryId: null, episodeLogId: LOG, data: series }))
      .toMatchObject({ kind: "progress", episodeLogId: LOG, share: true });
    expect(parseCardSave({ ...finish, kind: "sticker", templateId: "sticker", size: "feed", share: undefined })).toMatchObject({
      kind: "sticker",
      share: false,
    });
  });

  it("rejects mismatches", () => {
    const bad = [
      { ...finish, id: "not-a-uuid" },
      { ...finish, templateId: "sticker" }, // sticker template for a finish card
      { ...finish, kind: "sticker" }, // finish template for a sticker
      { ...finish, templateId: "unknown" },
      { ...finish, entryId: null }, // a finish card needs its entry
      { ...finish, episodeLogId: LOG }, // not both
      { ...finish, kind: "progress", templateId: "polaroid" }, // no progress data
      { ...finish, data: { ...data, progress } }, // finish card with progress
      { ...finish, size: "square" },
    ];
    for (const b of bad) expect(parseCardSave(b), JSON.stringify(b)).toBeNull();
  });

  const recapCard = { id: ID, kind: "weekly_recap", templateId: "collage", size: "story", recapId: RECAP, data: { ...data, recap } };

  it("accepts a recap card and its sticker, linked to the recap", () => {
    expect(parseCardSave(recapCard)).toMatchObject({ kind: "weekly_recap", recapId: RECAP, entryId: null, data: { recap } });
    expect(parseCardSave({ ...recapCard, kind: "sticker", templateId: "sticker" })).toMatchObject({ kind: "sticker", recapId: RECAP });
  });

  it("rejects recap mismatches", () => {
    const bad = [
      { ...recapCard, data }, // no recap data
      { ...recapCard, entryId: ENTRY }, // a recap has no entry
      { ...recapCard, templateId: "ticket" },
      { ...finish, recapId: RECAP }, // not both
      { ...recapCard, recapId: "nope" },
      { ...recapCard, data: { ...data, recap, progress } },
      { ...recapCard, data: { ...data, recap: { ...recap, period: "month" } } }, // a period makes it a stats card
    ];
    for (const b of bad) expect(parseCardSave(b), JSON.stringify(b)).toBeNull();
  });

  const statsCard = { id: ID, kind: "stats", templateId: "boldStats", size: "story", data: { ...data, recap: { ...recap, period: "year" } } };

  it("accepts a stats card (Share stats), with no source", () => {
    expect(parseCardSave(statsCard)).toMatchObject({ kind: "stats", recapId: null, entryId: null, data: { recap: { period: "year" } } });
    expect(parseCardSave({ ...statsCard, templateId: "collage" })).toMatchObject({ kind: "stats" });
  });

  it("rejects stats mismatches", () => {
    const bad = [
      { ...statsCard, data: { ...data, recap } }, // no period
      { ...statsCard, recapId: RECAP },
      { ...statsCard, entryId: ENTRY },
      { ...statsCard, templateId: "ticket" },
    ];
    for (const b of bad) expect(parseCardSave(b), JSON.stringify(b)).toBeNull();
  });
});

describe("parseRecap", () => {
  it("keeps a valid recap", () => {
    expect(parseRecap(recap)).toEqual(recap);
    expect(parseRecap({ ...recap, period: "all", minutes: 250_000 })).toMatchObject({ period: "all", minutes: 250_000 });
    expect(parseRecap({ ...recap, titles: [{ name: "M", kind: "movie" }] })).toMatchObject({ titles: [{ name: "M", posterUrl: null }] });
  });

  it("rejects malformed recaps", () => {
    const bad = [
      null,
      { ...recap, from: "2026-09-28", to: "2026-09-27" },
      { ...recap, minutes: -1 },
      { ...recap, titles: Array(5).fill(recap.titles[0]) },
      { ...recap, titleCount: 0 },
      { ...recap, titles: [{ ...recap.titles[0], posterUrl: "https://evil.example/x.jpg" }] },
      { ...recap, titles: [{ ...recap.titles[0], kind: "book" }] },
      { ...recap, period: "decade" },
    ];
    for (const b of bad) expect(parseRecap(b), JSON.stringify(b)).toBeNull();
  });
});

describe("templates", () => {
  it("lists templates per card kind", () => {
    expect(templatesFor("finish")).toEqual(["ticket", "polaroid", "boldStats"]);
    expect(templatesFor("progress")).toEqual(["polaroid", "boldStats"]);
    expect(templatesFor("weekly_recap")).toEqual(["boldStats", "collage"]);
    expect(templatesFor("stats")).toEqual(["boldStats", "collage"]);
    expect(templatesFor("sticker")).toEqual(["sticker"]);
    expect(templateFits("ticket", "progress", "story")).toBe(false);
  });

  it("builds the storage path", () => {
    expect(cardImagePath("u1", ID)).toBe(`u1/${ID}.png`);
  });
});
