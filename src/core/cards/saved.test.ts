import { describe, expect, it } from "vitest";
import { cardImagePath, crossedMilestone, parseCardData, parseCardSave, parseRecap, readingProgress } from "./saved";
import { defaultTemplate, isProTemplate, TEMPLATE_IDS, templateFits, templatesFor } from "./templates";

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

  it("drops a photo the browser sends: the server stamps the profile's own (ADR 0068)", () => {
    const parsed = parseCardData({ ...data, avatarUrl: "https://evil.example/me.png", hide: ["photo"] })!;
    expect(parsed).not.toHaveProperty("avatarUrl");
    expect(parsed.hide).toEqual(["photo"]);
  });

  it("rejects bad inputs", () => {
    const bad = [
      { ...data, kind: "podcast" },
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

describe("a game's Finish card (S3 games)", () => {
  const game = {
    kind: "game",
    name: "The Witcher 3: Wild Hunt",
    year: 2015,
    posterUrl: "https://media.rawg.io/media/resize/640/-/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg",
    finishedOn: "2026-09-30",
    playtimeHours: 43,
    hoursPlayed: 187,
  };

  it("keeps RAWG art and the hours, and saves on the cartridge", () => {
    expect(parseCardData(game)).toMatchObject({ kind: "game", playtimeHours: 43, hoursPlayed: 187, posterUrl: game.posterUrl });
    expect(parseCardData({ ...game, hoursPlayed: null })).toMatchObject({ hoursPlayed: null });
    expect(parseCardSave({ id: ID, kind: "finish", templateId: "cartridge", size: "story", entryId: ENTRY, data: game })).toMatchObject({
      templateId: "cartridge",
    });
  });

  it("rejects hours out of range or on anything but a game, and a game on the cartridge's neighbours' templates it can't take", () => {
    for (const bad of [
      { ...game, hoursPlayed: 0 },
      { ...game, hoursPlayed: 10_000 },
      { ...game, playtimeHours: 1.5 },
      { ...data, hoursPlayed: 3 },
      { ...data, playtimeHours: 3 },
    ]) {
      expect(parseCardData(bad), JSON.stringify(bad)).toBeNull();
    }
    // No Progress cards for games (there's no progress to log), and no Film Strip.
    expect(parseCardSave({ id: ID, kind: "progress", templateId: "boldStats", size: "story", data: game })).toBeNull();
    expect(parseCardSave({ id: ID, kind: "finish", templateId: "filmStrip", size: "story", entryId: ENTRY, data: game })).toBeNull();
  });
});

describe("parseCardSave", () => {
  const finish = { id: ID, kind: "finish", templateId: "ticket", size: "story", entryId: ENTRY, data, share: true };

  it("accepts a finish card, a progress card and a sticker", () => {
    expect(parseCardSave(finish)).toMatchObject({ kind: "finish", entryId: ENTRY, episodeLogId: null, share: true });
    const series = { ...data, kind: "series", progress };
    expect(parseCardSave({ ...finish, kind: "progress", templateId: "boldStats", entryId: null, episodeLogId: LOG, data: series })).toMatchObject({
      kind: "progress",
      episodeLogId: LOG,
      share: true,
    });
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
    // An "Imported N books" card (S3 import & export).
    const imported = { ...recap, period: "all", imported: true, importedUnit: "book" };
    expect(parseRecap(imported)).toMatchObject({ imported: true, importedUnit: "book" });
    // Play time and a stats card's favourites (stage 4) survive saving.
    const favourites = [
      { role: "actor", name: "Song Kang-ho" },
      { role: "director", name: "Bong Joon Ho" },
    ];
    expect(parseRecap({ ...recap, period: "all", playMinutes: 1200, favourites })).toMatchObject({ playMinutes: 1200, favourites });
  });

  it("rejects malformed recaps", () => {
    const bad = [
      null,
      { ...recap, from: "2026-09-28", to: "2026-09-27" },
      { ...recap, minutes: -1 },
      { ...recap, titles: Array(5).fill(recap.titles[0]) },
      { ...recap, titleCount: 0 },
      { ...recap, titles: [{ ...recap.titles[0], posterUrl: "https://evil.example/x.jpg" }] },
      { ...recap, titles: [{ ...recap.titles[0], kind: "podcast" }] },
      { ...recap, period: "decade" },
      { ...recap, period: "all", imported: true, importedUnit: "podcast" },
      { ...recap, playMinutes: -5 },
      // Favourites: only on a stats period, known roles, once each, at most two.
      { ...recap, favourites: [{ role: "actor", name: "A" }] },
      { ...recap, period: "all", favourites: [{ role: "grip", name: "A" }] },
      {
        ...recap,
        period: "all",
        favourites: [
          { role: "actor", name: "A" },
          { role: "actor", name: "B" },
        ],
      },
      {
        ...recap,
        period: "all",
        favourites: [
          { role: "actor", name: "A" },
          { role: "director", name: "B" },
          { role: "studio", name: "C" },
        ],
      },
      { ...recap, period: "all", favourites: [{ role: "actor", name: " " }] },
      { ...recap, importedUnit: "book" },
    ];
    for (const b of bad) expect(parseRecap(b), JSON.stringify(b)).toBeNull();
  });
});

describe("templates", () => {
  it("lists templates per card kind", () => {
    expect(templatesFor("finish", "movie")).toEqual(["ticket", "polaroid", "boldStats", "filmStrip", "premiere"]);
    expect(templatesFor("progress", "series")).toEqual(["polaroid", "boldStats", "filmStrip", "premiere"]);
    expect(templatesFor("weekly_recap", "series")).toEqual(["boldStats", "collage", "lineup"]);
    expect(templatesFor("stats", "movie")).toEqual(["boldStats", "collage", "lineup"]);
    expect(templatesFor("sticker", "movie")).toEqual(["sticker"]);
    expect(templateFits("ticket", "progress", "story", "series")).toBe(false);
  });

  it("adds the spine for books and manga, and the manga panel for manga only (S2 books & manga)", () => {
    expect(templatesFor("finish", "book")).toEqual(["ticket", "polaroid", "boldStats", "spine", "gilded"]);
    expect(templatesFor("finish", "manga")).toEqual(["ticket", "polaroid", "boldStats", "spine", "mangaPanel", "gilded"]);
    expect(templatesFor("progress", "manga")).toEqual(["polaroid", "boldStats", "spine", "mangaPanel", "gilded"]);
    expect(templatesFor("progress", "book")).toEqual(["polaroid", "boldStats", "spine", "gilded"]);
    expect(templatesFor("sticker", "manga")).toEqual(["sticker"]);
    expect(templateFits("spine", "finish", "feed", "movie")).toBe(false);
    expect(templateFits("mangaPanel", "progress", "story", "book")).toBe(false);
    expect(templateFits("mangaPanel", "progress", "story", "manga")).toBe(true);
    expect(templateFits("spine", "weekly_recap", "story", "book")).toBe(false);
  });

  it("adds the cartridge for a game's finish, and opens on it (S3 games)", () => {
    expect(templatesFor("finish", "game")).toEqual(["ticket", "polaroid", "boldStats", "cartridge", "arcade"]);
    expect(defaultTemplate("finish", "game")).toBe("cartridge");
    expect(templateFits("cartridge", "finish", "feed", "game")).toBe(true);
    expect(templateFits("cartridge", "finish", "story", "movie")).toBe(false);
    expect(templateFits("cartridge", "progress", "story", "game")).toBe(false);
    expect(templateFits("filmStrip", "finish", "story", "game")).toBe(false);
  });

  it("has a Pro style for each kind of card, last on the swipe and never the one a card opens on (ADR 0084)", () => {
    expect(TEMPLATE_IDS.filter(isProTemplate)).toEqual(["filmStrip", "premiere", "gilded", "arcade", "lineup"]);
    const lastIsPro = (ids: string[]) => ids.at(-1);
    expect(lastIsPro(templatesFor("finish", "series"))).toBe("premiere");
    expect(lastIsPro(templatesFor("progress", "book"))).toBe("gilded");
    expect(lastIsPro(templatesFor("finish", "manga"))).toBe("gilded");
    expect(lastIsPro(templatesFor("finish", "game"))).toBe("arcade");
    for (const kind of ["weekly_recap", "monthly_recap", "stats", "year_review"] as const) expect(lastIsPro(templatesFor(kind, "book"))).toBe("lineup");
    // Each draws only its own kind of title and card.
    expect(templateFits("premiere", "finish", "feed", "book")).toBe(false);
    expect(templateFits("gilded", "finish", "story", "movie")).toBe(false);
    expect(templateFits("arcade", "progress", "story", "game")).toBe(false);
    expect(templateFits("arcade", "finish", "story", "series")).toBe(false);
    expect(templateFits("lineup", "finish", "story", "movie")).toBe(false);
    expect(templateFits("lineup", "milestone", "story", "movie")).toBe(false);
    expect(templateFits("lineup", "year_review", "feed", "game")).toBe(true);
    for (const kind of ["finish", "progress", "weekly_recap", "stats", "year_review"] as const) {
      for (const title of ["movie", "series", "book", "manga", "game"] as const) expect(isProTemplate(defaultTemplate(kind, title))).toBe(false);
    }
  });

  it("opens a new card on the template made for its title", () => {
    expect(defaultTemplate("finish", "movie")).toBe("polaroid");
    expect(defaultTemplate("progress", "series")).toBe("boldStats");
    expect(defaultTemplate("finish", "book")).toBe("spine");
    expect(defaultTemplate("progress", "book")).toBe("spine");
    expect(defaultTemplate("finish", "manga")).toBe("mangaPanel");
    expect(defaultTemplate("progress", "manga")).toBe("mangaPanel");
    expect(defaultTemplate("weekly_recap", "series")).toBe("collage");
    expect(defaultTemplate("stats", "movie")).toBe("boldStats");
    expect(defaultTemplate("sticker", "manga")).toBe("sticker");
    // Every default is one the card can actually use.
    for (const kind of ["finish", "progress"] as const) {
      for (const title of ["movie", "series", "book", "manga"] as const) {
        if (kind === "progress" && title === "movie") continue;
        expect(templatesFor(kind, title)).toContain(defaultTemplate(kind, title));
      }
    }
  });

  it("builds the storage path", () => {
    expect(cardImagePath("u1", ID)).toBe(`u1/${ID}.png`);
  });
});

describe("reading Progress cards (S2 books & manga)", () => {
  const manga = {
    kind: "manga",
    name: "One Piece",
    year: 1997,
    posterUrl: "https://s4.anilist.co/file/anilistcdn/media/manga/cover/medium/bx30013-BeslEMqiPhlk.jpg",
    finishedOn: "2026-09-27",
  };
  const log = (id: string, position: number, readAt: string) => ({ id, titleId: "op", unit: "chapter" as const, position, readAt });

  it("logging chapter 1100 of a running manga makes a Progress card: where, and the reading time so far", () => {
    const after = [log("a", 1100, "2026-09-27T10:00:00Z")];
    const reading = readingProgress({ kind: "manga", chapterCount: null }, [], after, "chapter", 1100);
    expect(reading).toEqual({ unit: "chapter", position: 1100, total: null, readMin: 5500, milestone: null });
    const save = { id: ID, kind: "progress", templateId: "boldStats", size: "story", readingLogId: LOG, data: { ...manga, reading }, share: true };
    expect(parseCardSave(save)).toMatchObject({ kind: "progress", readingLogId: LOG, episodeLogId: null, data: { kind: "manga", reading } });
    expect(parseCardSave({ ...save, templateId: "polaroid" })).not.toBeNull();
    expect(parseCardSave({ ...save, templateId: "mangaPanel" })).not.toBeNull();
    expect(parseCardSave({ ...save, templateId: "spine" })).not.toBeNull();
  });

  it("marks milestones when the length is known, and drops a total the reader is already past", () => {
    const lengths = { kind: "manga" as const, chapterCount: 232 };
    const before = [log("a", 100, "2026-09-01T10:00:00Z")];
    const after = [...before, log("b", 120, "2026-09-02T10:00:00Z")];
    expect(readingProgress(lengths, before, after, "chapter", 120)).toMatchObject({ total: 232, milestone: 50 });
    expect(readingProgress({ kind: "manga", chapterCount: 100 }, [], [log("c", 120, "2026-09-02T10:00:00Z")], "chapter", 120)).toMatchObject({
      total: null,
      milestone: null,
    });
  });

  it("accepts a book's Finish card and rejects reading progress that doesn't add up", () => {
    const book = { kind: "book", name: "Project Hail Mary", posterUrl: "/api/covers/3fzJEAAAQBAJ", pageCount: 496, finishedOn: "2026-09-27" };
    expect(parseCardSave({ id: ID, kind: "finish", templateId: "ticket", size: "feed", entryId: ENTRY, data: book })).toMatchObject({
      data: { pageCount: 496 },
    });
    expect(parseCardSave({ id: ID, kind: "finish", templateId: "spine", size: "feed", entryId: ENTRY, data: book })).not.toBeNull();
    // The manga panel is for manga, and neither reading template draws a movie.
    expect(parseCardSave({ id: ID, kind: "finish", templateId: "mangaPanel", size: "feed", entryId: ENTRY, data: book })).toBeNull();
    expect(
      parseCardSave({ id: ID, kind: "finish", templateId: "spine", size: "feed", entryId: ENTRY, data: { ...book, kind: "movie", pageCount: null } }),
    ).toBeNull();
    const reading = { unit: "chapter", position: 1100, total: null, readMin: 5500, milestone: null };
    const progress = { id: ID, kind: "progress", templateId: "boldStats", size: "story", readingLogId: LOG, data: { ...manga, reading } };
    for (const bad of [
      { ...progress, data: { ...manga, reading: { ...reading, unit: "episode" } } },
      { ...progress, data: { ...manga, reading: { ...reading, total: 1000 } } }, // past the end
      { ...progress, data: { ...manga, reading: { ...reading, milestone: 50 } } }, // a milestone needs a length
      { ...progress, data: { ...manga, reading: null } },
      { ...progress, data: { ...manga, kind: "series", reading } }, // series progress is by episode
      { ...progress, episodeLogId: LOG, readingLogId: null },
      { ...progress, entryId: ENTRY },
      { ...progress, data: { ...manga, reading, posterUrl: "https://books.google.com/books/content?id=x" } },
    ]) {
      expect(parseCardSave(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("Survived cards (S2 content warnings)", () => {
  const finish = { id: ID, kind: "finish", templateId: "survived", size: "story", entryId: ENTRY, data: { ...data, survived: "jumpScares" } };

  it("offers the Survived template first, only when there's a scare", () => {
    expect(templatesFor("finish", "movie", { survived: true })).toEqual(["survived", "ticket", "polaroid", "boldStats", "filmStrip", "premiere"]);
    expect(templatesFor("finish", "book", { survived: true })).not.toContain("survived");
    expect(templatesFor("progress", "series", { survived: true })).not.toContain("survived");
  });

  it("saves a finish on the Survived template with its scare", () => {
    expect(parseCardSave(finish)?.data.survived).toBe("jumpScares");
    expect(parseCardData(data)?.survived).toBeNull();
  });

  it("rejects a scare on another template, the template without one, and unknown scares", () => {
    expect(parseCardSave({ ...finish, templateId: "polaroid" })).toBeNull();
    expect(parseCardSave({ ...finish, data })).toBeNull();
    expect(parseCardSave({ ...finish, data: { ...data, survived: "taxes" } })).toBeNull();
    expect(parseCardData({ ...data, kind: "book", survived: "gore" })).toBeNull();
    expect(parseCardData({ ...data, survived: "gore", progress })).toBeNull();
    expect(parseCardSave({ ...finish, kind: "sticker", templateId: "sticker", entryId: null })).toBeNull();
  });
});

describe("Rare finishes (ADR 0067)", () => {
  it("keeps a finish card's share and lets it be hidden", () => {
    expect(parseCardData({ ...data, finishShare: 0.004 })?.finishShare).toBe(0.004);
    expect(parseCardData(data)?.finishShare).toBeNull();
    expect(parseCardData({ ...data, finishShare: 0.004, hide: ["finisher"] })?.hide).toEqual(["finisher"]);
  });

  it("rejects odd shares and shares on anything but a finish", () => {
    for (const finishShare of [0, -0.1, 1.5, "0.1", Number.NaN]) {
      expect(parseCardData({ ...data, finishShare }), String(finishShare)).toBeNull();
    }
    expect(parseCardData({ ...data, finishShare: 0.004, progress })).toBeNull();
  });

  it("ignores the finisher number of cards saved before", () => {
    const old = parseCardData({ ...data, finisherNo: 1204 });
    expect(old).not.toBeNull();
    expect(old).not.toHaveProperty("finisherNo");
  });
});

describe("Challenge cards (S3 challenges & clubs)", () => {
  const challenge = { slug: "fright-month", month: "2026-10", target: 3, days: [9, 2, 2, 24] };
  const save = { id: ID, kind: "challenge", templateId: "calendar", size: "story", data: { ...data, challenge }, share: true };

  it("accepts a challenge of that month's lineup, with its calendar days sorted", () => {
    expect(parseCardSave(save)).toMatchObject({ kind: "challenge", templateId: "calendar", entryId: null });
    expect(parseCardData({ ...data, challenge })?.challenge).toEqual({ slug: "fright-month", month: "2026-10", target: 3, days: [2, 9, 24] });
    expect(parseCardSave({ ...save, templateId: "boldStats" })).not.toBeNull();
    expect(parseCardSave({ ...save, kind: "sticker", templateId: "sticker" })).not.toBeNull();
  });

  it("rejects another month's challenge, a wrong target, odd days and mixing", () => {
    expect(parseCardData({ ...data, challenge: { ...challenge, month: "2026-11" } })).toBeNull();
    expect(parseCardData({ ...data, challenge: { ...challenge, target: 1 } })).toBeNull();
    expect(parseCardData({ ...data, challenge: { ...challenge, days: [0] } })).toBeNull();
    expect(parseCardData({ ...data, challenge: { ...challenge, days: [32] } })).toBeNull();
    expect(parseCardData({ ...data, challenge, progress })).toBeNull();
    expect(parseCardData({ ...data, challenge, finishShare: 0.004 })).toBeNull();
    expect(parseCardSave({ ...save, data })).toBeNull();
    expect(parseCardSave({ ...save, entryId: ENTRY })).toBeNull();
    expect(parseCardSave({ ...save, templateId: "stone" })).toBeNull();
    expect(parseCardSave({ ...save, kind: "finish", entryId: ENTRY, templateId: "ticket" })).toBeNull();
  });
});

describe("Reel of the Day cards (stage 4 daily game)", () => {
  const reel = { number: 6, day: "2026-10-05", results: [false, false, true], solved: true, streak: 4 };
  const reelData = { kind: "movie", name: "Reel of the Day #6", finishedOn: "2026-10-05", posterUrl: null, reel };
  const save = { id: ID, kind: "reel", templateId: "reel", size: "story", data: reelData, share: true };

  it("accepts a consistent result, as a reel card or its sticker", () => {
    expect(parseCardSave(save)).toMatchObject({ kind: "reel", templateId: "reel", data: { reel } });
    expect(parseCardSave({ ...save, kind: "sticker", templateId: "sticker" })).toMatchObject({ kind: "sticker" });
    const lost = { ...reel, results: [false, false, false, false, false, false], solved: false, streak: 0 };
    expect(parseCardData({ ...reelData, reel: lost })?.reel).toEqual(lost);
  });

  it("rejects results that can't happen, a poster (a spoiler), and mixing", () => {
    const bad = [
      { ...reel, number: 7 }, // not that day's number
      { ...reel, results: [true, false] }, // a hit ends the play
      { ...reel, results: [false, false], solved: false, streak: 0 }, // lost with guesses left
      { ...reel, solved: false }, // the last result says solved
      { ...reel, streak: 0 }, // a win starts a streak
      { ...reel, results: [] },
    ];
    for (const b of bad) expect(parseCardData({ ...reelData, reel: b }), JSON.stringify(b)).toBeNull();
    expect(parseCardData({ ...reelData, posterUrl: "https://image.tmdb.org/t/p/w342/matrix.jpg" })).toBeNull();
    expect(parseCardData({ ...reelData, kind: "series" })).toBeNull();
    expect(parseCardSave({ ...save, kind: "finish", entryId: ENTRY })).toBeNull();
    expect(parseCardSave({ ...save, kind: "stats", templateId: "boldStats" })).toBeNull();
    expect(parseCardSave({ ...save, data: { ...reelData, reel: null } })).toBeNull();
  });
});

describe("Atlas cards (stage 4, ADR 0059)", () => {
  const atlas = { countries: ["TH", "FR", "JP", "FR"], stories: 12 };
  const atlasData = { kind: "movie", name: "Atlas", finishedOn: "2026-10-01", posterUrl: null, atlas };
  const save = { id: ID, kind: "atlas", templateId: "atlas", size: "feed", data: atlasData, share: true };

  it("accepts known countries (unique and sorted), as an Atlas card or its sticker", () => {
    expect(parseCardSave(save)).toMatchObject({
      kind: "atlas",
      templateId: "atlas",
      data: { atlas: { countries: ["FR", "JP", "TH"], stories: 12 } },
    });
    expect(parseCardSave({ ...save, kind: "sticker", templateId: "sticker" })).toMatchObject({ kind: "sticker" });
  });

  it("rejects no or unknown countries, odd story counts, a poster, and mixing", () => {
    for (const bad of [
      { ...atlas, countries: [] },
      { ...atlas, countries: ["ZZ"] },
      { ...atlas, countries: "TH" },
      { ...atlas, stories: -1 },
      { ...atlas, stories: 1.5 },
    ]) {
      expect(parseCardData({ ...atlasData, atlas: bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(parseCardData({ ...atlasData, posterUrl: "https://image.tmdb.org/t/p/w342/matrix.jpg" })).toBeNull();
    expect(parseCardData({ ...atlasData, finishShare: 0.004 })).toBeNull();
    expect(parseCardSave({ ...save, kind: "finish", entryId: ENTRY })).toBeNull();
    expect(parseCardSave({ ...save, kind: "stats", templateId: "boldStats" })).toBeNull();
    expect(parseCardSave({ ...save, data: { ...atlasData, atlas: null } })).toBeNull();
    expect(parseCardSave({ ...save, templateId: "reel" })).toBeNull();
  });

  // A country's card (ADR 0060): that country and its marked regions.
  const regions = { country: "JP", kind: "prefecture", total: 47, ids: ["JP-01", "JP-13", "JP-26"] };
  const japan = { countries: ["JP"], stories: 0, regions };

  it("takes a country's card with its regions", () => {
    expect(parseCardData({ ...atlasData, name: "Japan", atlas: japan })).toMatchObject({ atlas: { countries: ["JP"], regions } });
  });

  it("rejects regions of another country, more than there are, repeats, and a card of several countries", () => {
    for (const bad of [
      { ...japan, countries: ["JP", "TH"] },
      { ...japan, regions: { ...regions, country: "TH" } },
      { ...japan, regions: { ...regions, ids: ["TH-10"] } },
      { ...japan, regions: { ...regions, ids: [] } },
      { ...japan, regions: { ...regions, ids: ["JP-01", "JP-01"] } },
      { ...japan, regions: { ...regions, total: 2 } },
      { ...japan, regions: { ...regions, kind: "Prefecture!" } },
      { ...japan, regions: "JP-01" },
    ]) {
      expect(parseCardData({ ...atlasData, atlas: bad }), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("Shelf cards (ADR 0095)", () => {
  const poster = "https://image.tmdb.org/t/p/w342/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg";
  const titles = Array.from({ length: 10 }, (_, i) => ({ name: `Title ${i + 1}`, kind: "movie", posterUrl: i ? poster : null }));
  const shelf = { titles, pinned: 4, total: 120 };
  const shelfData = { kind: "movie", name: "My Shelf", finishedOn: "2026-10-05", posterUrl: null, shelf };
  const save = { id: ID, kind: "shelf", templateId: "shelf", size: "story", data: shelfData, share: true };

  it("takes up to ten titles, as a Shelf card or its sticker", () => {
    expect(parseCardSave(save)).toMatchObject({ kind: "shelf", templateId: "shelf", data: { shelf: { pinned: 4, total: 120 } } });
    expect(parseCardSave({ ...save, kind: "sticker", templateId: "sticker" })).toMatchObject({ kind: "sticker" });
    expect(defaultTemplate("shelf", "movie")).toBe("shelf");
  });

  it("rejects too many or no titles, odd counts, other posters, and mixing", () => {
    for (const bad of [
      { ...shelf, titles: [] },
      { ...shelf, titles: [...titles, titles[0]] },
      { ...shelf, pinned: 11 },
      { ...shelf, total: 9 },
      { ...shelf, titles: [{ name: "X", kind: "movie", posterUrl: "https://evil.example/x.jpg" }], total: 1, pinned: 0 },
      { ...shelf, titles: [{ name: "", kind: "movie", posterUrl: null }], total: 1, pinned: 0 },
    ]) {
      expect(parseCardData({ ...shelfData, shelf: bad }), JSON.stringify(bad)).toBeNull();
    }
    expect(parseCardData({ ...shelfData, posterUrl: poster })).toBeNull();
    expect(parseCardData({ ...shelfData, atlas: { countries: ["TH"], stories: 0 } })).toBeNull();
    expect(parseCardSave({ ...save, kind: "stats", templateId: "boldStats" })).toBeNull();
    expect(parseCardSave({ ...save, data: { ...shelfData, shelf: null } })).toBeNull();
    expect(parseCardSave({ ...save, templateId: "atlas" })).toBeNull();
  });
});
