import { describe, expect, it } from "vitest";
import { periodRange } from "./period";
import { parseRecap } from "../cards/saved";
import { addMonths, collectionAreaTotals, collectionCards, statsReport, type ReportPerson, type ReportTitle } from "./report";
import { summarizeCollection, type StatsEntry, type StatsEpisodeLog } from "./summary";

const title = (t: Partial<ReportTitle> & Pick<ReportTitle, "id" | "kind" | "name">): ReportTitle => ({
  runtimeMin: null,
  episodeCount: null,
  posterUrl: null,
  genres: [],
  originalLanguage: null,
  ...t,
});

const titles: ReportTitle[] = [
  title({ id: "parasite", kind: "movie", name: "Parasite", runtimeMin: 133, genres: ["Thriller", "Drama"], originalLanguage: "ko" }),
  title({ id: "dune", kind: "movie", name: "Dune", runtimeMin: 166, genres: ["Science Fiction"], originalLanguage: "en" }),
  title({ id: "arcane", kind: "series", name: "Arcane", runtimeMin: 40, episodeCount: 18, genres: ["Animation", "Drama"], originalLanguage: "en" }),
  title({ id: "chernobyl", kind: "series", name: "Chernobyl", runtimeMin: 65, episodeCount: 5, genres: ["Drama"], originalLanguage: "en" }),
  title({ id: "severance", kind: "series", name: "Severance", runtimeMin: 55, episodeCount: 19, genres: ["Drama"], originalLanguage: "en" }),
];

const entries: StatsEntry[] = [
  { id: "e1", titleId: "parasite", status: "finished", finishedAt: "2026-09-10T20:00:00Z" },
  { id: "e2", titleId: "dune", status: "finished", finishedAt: "2026-03-01T12:00:00Z" },
  // Finished without logging episodes: all 5 count on the finish date.
  { id: "e3", titleId: "chernobyl", status: "finished", finishedAt: "2026-09-20T12:00:00Z" },
  { id: "e4", titleId: "arcane", status: "finished", finishedAt: "2026-09-03T15:00:00Z" },
  { id: "e5", titleId: "severance", status: "watching", finishedAt: null, deletedAt: "2026-09-06T00:00:00Z" },
];

const logs: StatsEpisodeLog[] = [
  { id: "l1", titleId: "arcane", runtimeMin: 42, watchedAt: "2026-08-31T12:00:00Z" },
  { id: "l2", titleId: "arcane", runtimeMin: null, watchedAt: "2026-09-01T12:00:00Z" },
  { id: "l3", titleId: "arcane", runtimeMin: 39, watchedAt: "2026-09-02T12:00:00Z" },
  { id: "l4", titleId: "arcane", runtimeMin: 40, watchedAt: "2026-09-03T12:00:00Z", deletedAt: "2026-09-04T00:00:00Z" },
  // An episode logged on a title whose entry was removed still counts, as in the collection summary.
  { id: "l5", titleId: "severance", runtimeMin: 57, watchedAt: "2026-09-05T12:00:00Z" },
];

const now = Date.parse("2026-09-27T10:00:00Z"); // a Sunday
const base = { timeZone: "UTC", weekStart: 1, now };

describe("statsReport", () => {
  it("matches the collection summary for every period", () => {
    for (const period of ["week", "month", "year", "all"] as const) {
      for (const timeZone of ["UTC", "Asia/Bangkok", "America/Los_Angeles", "Asia/Kolkata"]) {
        const range = periodRange(period, { timeZone, weekStart: 1, now });
        const report = statsReport(titles, entries, logs, { ...base, timeZone, period });
        expect(report.totals).toEqual(summarizeCollection(titles, entries, logs, range));
        const split = report.split.movie.minutes + report.split.series.minutes;
        expect(split).toBe(report.totals.minutes);
        expect(report.split.movie.finished + report.split.series.finished).toBe(report.totals.finished);
      }
    }
  });

  it("fills the month bars, heatmap, taste and records for this month", () => {
    const report = statsReport(titles, entries, logs, { ...base, period: "month" });
    expect(report.totals).toMatchObject({ minutes: 133 + 65 * 5 + 40 + 39 + 57, episodes: 2 + 5 + 1, finished: 3 });

    expect(report.months).toHaveLength(12);
    expect(report.months[0]!.month).toBe("2025-10");
    expect(report.months.at(-1)).toEqual({ month: "2026-09", minutes: 133 + 325 + 40 + 39 + 57, finished: 3 });
    expect(report.months.find((m) => m.month === "2026-08")).toEqual({ month: "2026-08", minutes: 42, finished: 0 });
    expect(report.months.find((m) => m.month === "2026-03")).toEqual({ month: "2026-03", minutes: 166, finished: 1 });

    // 53 Monday-first weeks ending today.
    expect(report.heatmap).toMatchObject({ from: "2025-09-22", to: "2026-09-27" });
    expect(report.heatmap.days).toMatchObject({ "2026-08-31": 1, "2026-09-03": 1, "2026-09-10": 1, "2026-09-20": 6 });
    expect(report.heatmap.days["2026-09-04"]).toBeUndefined();

    expect(report.genres).toEqual([
      { key: "Drama", count: 4 },
      { key: "Animation", count: 1 },
      { key: "Thriller", count: 1 },
    ]);
    expect(report.languages).toEqual([
      { key: "en", count: 3 },
      { key: "ko", count: 1 },
    ]);
    expect(report.records).toEqual({
      longestMovie: { name: "Parasite", minutes: 133 },
      // By each series' whole watch time: Arcane's 121 min include August's episode.
      longestSeries: { name: "Chernobyl", minutes: 325 },
      busiestMonth: { month: "2026-09", minutes: 594 },
      // Two episodes, then the finish on the 3rd.
      longestStreak: { days: 3, from: "2026-09-01", to: "2026-09-03" },
    });
  });

  it("finds streaks across months and the busiest month, all time", () => {
    const report = statsReport(titles, entries, logs, { ...base, period: "all" });
    expect(report.records.longestStreak).toEqual({ days: 4, from: "2026-08-31", to: "2026-09-03" });
    expect(report.records.busiestMonth).toEqual({ month: "2026-09", minutes: 594 });
    expect(report.records.longestMovie).toEqual({ name: "Dune", minutes: 166 });
    expect(report.records.longestSeries).toEqual({ name: "Chernobyl", minutes: 325 });
  });

  it("uses local days: a late-evening log in Los Angeles is the day before in UTC", () => {
    const late: StatsEpisodeLog[] = [{ id: "x", titleId: "arcane", runtimeMin: 40, watchedAt: "2026-09-02T03:00:00Z" }];
    const report = statsReport(titles, [], late, { ...base, timeZone: "America/Los_Angeles", period: "all" });
    expect(Object.keys(report.heatmap.days)).toEqual(["2026-09-01"]);
  });

  it("builds the Share stats card for the period", () => {
    // Nothing this week (Chernobyl was finished last Sunday).
    expect(statsReport(titles, entries, logs, { ...base, period: "week" }).card).toBeNull();
    expect(statsReport(titles, entries, logs, { ...base, period: "month" }).card).toEqual({
      period: "month",
      from: "2026-09-01",
      to: "2026-09-27",
      minutes: 594,
      episodes: 8,
      finished: 3,
      titleCount: 4,
      titles: [
        { name: "Chernobyl", kind: "series", posterUrl: null },
        { name: "Parasite", kind: "movie", posterUrl: null },
        { name: "Arcane", kind: "series", posterUrl: null },
        { name: "Severance", kind: "series", posterUrl: null },
      ],
    });
    const all = statsReport(titles, entries, logs, { ...base, period: "all" }).card!;
    expect(all).toMatchObject({ period: "all", from: "2026-03-01", to: "2026-09-27", titleCount: 5 });
    // Most watched first.
    expect(all.titles.map((t) => t.name)).toEqual(["Chernobyl", "Dune", "Parasite", "Arcane"]);
  });

  it("is empty for an empty collection", () => {
    const report = statsReport(titles, [], [], { ...base, period: "all" });
    expect(report.card).toBeNull();
    expect(report.totals.finished).toBe(0);
    expect(report.heatmap.days).toEqual({});
    expect(report.genres).toEqual([]);
    expect(report.records).toEqual({ longestMovie: null, longestSeries: null, busiestMonth: null, longestStreak: null });
  });

  it("handles 1,000 entries and 20,000 episode logs quickly", () => {
    const many: ReportTitle[] = [];
    const manyEntries: StatsEntry[] = [];
    const manyLogs: StatsEpisodeLog[] = [];
    for (let i = 0; i < 1000; i++) {
      const series = i % 2 === 0;
      many.push(title({ id: `t${i}`, kind: series ? "series" : "movie", name: `T${i}`, runtimeMin: 45, episodeCount: 40, genres: ["Drama"], originalLanguage: "en" }));
      manyEntries.push({ id: `e${i}`, titleId: `t${i}`, status: "finished", finishedAt: new Date(now - i * 86_400_000).toISOString() });
      if (series) {
        for (let n = 0; n < 40; n++) manyLogs.push({ id: `l${i}-${n}`, titleId: `t${i}`, runtimeMin: 45, watchedAt: new Date(now - i * 86_400_000 - n * 3_600_000).toISOString() });
      }
    }
    // The best of three runs, so a busy machine (the whole suite in parallel) doesn't fail a fast algorithm.
    let report!: ReturnType<typeof statsReport>;
    let best = Infinity;
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      report = statsReport(many, manyEntries, manyLogs, { ...base, timeZone: "Europe/Berlin", period: "all" });
      best = Math.min(best, performance.now() - start);
    }
    expect(best).toBeLessThan(500);
    expect(report.totals.finished).toBe(1000);
  });
});

describe("favourites", () => {
  const person = (role: ReportPerson["role"], id: string, name: string, imageUrl: string | null = null): ReportPerson => ({ role, id, name, imageUrl });
  const song = person("actor", "tmdb:20738", "Song Kang-ho", "https://image.tmdb.org/t/p/w185/song.jpg");
  const bong = person("director", "tmdb:21684", "Bong Joon Ho");
  const cast = [
    title({ id: "parasite", kind: "movie", name: "Parasite", runtimeMin: 133, people: [song, bong, bong, person("studio", "tmdb:4399", "Barunson E&A")] }),
    title({ id: "memories", kind: "movie", name: "Memories of Murder", runtimeMin: 131, people: [song, bong] }),
    title({ id: "host", kind: "movie", name: "The Host", runtimeMin: 120, people: [song, person("actor", "tmdb:1", "Bae Doona")] }),
    title({ id: "dune", kind: "movie", name: "Dune", runtimeMin: 166, people: [person("actor", "tmdb:2", "Timothée Chalamet")] }),
    // Unfinished: never counted.
    title({ id: "okja", kind: "movie", name: "Okja", runtimeMin: 120, people: [person("actor", "tmdb:3", "Ahn Seo-hyun")] }),
    title({ id: "none", kind: "movie", name: "No credits", runtimeMin: 90, people: null }),
  ];
  // Two finishes in the week of Sep 7, the rest the week after.
  const days: Record<string, string> = { parasite: "08", memories: "09", host: "15", dune: "16", none: "17" };
  const finishes: StatsEntry[] = Object.entries(days).map(([id, day], i) => ({
    id: `f${i}`,
    titleId: id,
    status: "finished",
    finishedAt: `2026-09-${day}T12:00:00Z`,
  }));
  finishes.push({ id: "f9", titleId: "okja", status: "watching", finishedAt: null });

  it("ranks people over finished titles by titles, then time, and names them on the card from two titles", () => {
    const report = statsReport(cast, finishes, [], { ...base, period: "month" });
    expect(report.people.actor.map((p) => [p.name, p.titles, p.minutes])).toEqual([
      ["Song Kang-ho", 3, 133 + 131 + 120],
      ["Timothée Chalamet", 1, 166],
      ["Bae Doona", 1, 120],
    ]);
    expect(report.people.actor[0]!.imageUrl).toBe("https://image.tmdb.org/t/p/w185/song.jpg");
    // Listed twice on one title, counted once.
    expect(report.people.director).toEqual([{ id: "tmdb:21684", name: "Bong Joon Ho", imageUrl: null, titles: 2, minutes: 264 }]);
    expect(report.people.studio.map((p) => p.titles)).toEqual([1]);
    expect(report.people.author).toEqual([]);
    // The studio is in one title only: not a favourite on the card.
    expect(report.card?.favourites).toEqual([
      { role: "actor", name: "Song Kang-ho" },
      { role: "director", name: "Bong Joon Ho" },
    ]);
  });

  it("counts only the period's finishes, and leaves the card without favourites when none has two titles", () => {
    const week = statsReport(cast, finishes, [], { ...base, now: Date.parse("2026-09-10T10:00:00Z"), period: "week" });
    expect(week.people.actor.map((p) => p.name)).toEqual(["Song Kang-ho"]);
    expect(week.people.actor[0]!.titles).toBe(2);
    const one = statsReport(cast, finishes.slice(3), [], { ...base, period: "month" });
    expect(one.people.actor.map((p) => p.titles)).toEqual([1]);
    expect(one.card).not.toHaveProperty("favourites");
  });
});

describe("collectionCards (Share my collection)", () => {
  const shelf = [
    ...titles,
    title({ id: "hm", kind: "book", name: "Project Hail Mary", pageCount: 480 }),
    title({ id: "op", kind: "manga", name: "One Piece", volumeCount: 100 }),
    title({ id: "hades", kind: "game", name: "Hades", playtimeHours: 22 }),
  ];
  const more: StatsEntry[] = [
    ...entries,
    { id: "e6", titleId: "hm", status: "finished", finishedAt: "2026-09-12T12:00:00Z" },
    { id: "e7", titleId: "hades", status: "finished", finishedAt: "2026-09-14T12:00:00Z" },
  ];

  it("makes one all-time card per area, each with only its own kinds", () => {
    const cards = collectionCards(shelf, more, logs, base);
    const all = statsReport(shelf, more, logs, { ...base, period: "all" }).card!;

    expect(cards.watch).toMatchObject({ area: "watch", period: "all", minutes: all.minutes, episodes: all.episodes, finished: 4, titleCount: 5 });
    expect(cards.watch!.readMinutes).toBeUndefined();
    expect(cards.watch!.playMinutes).toBeUndefined();
    expect(cards.watch!.titles.every((t) => t.kind === "movie" || t.kind === "series")).toBe(true);

    expect(cards.read).toMatchObject({ area: "read", minutes: 0, episodes: 0, finished: 1, titleCount: 1, readMinutes: all.readMinutes });
    expect(cards.read!.titles.map((t) => t.name)).toEqual(["Project Hail Mary"]);

    expect(cards.play).toMatchObject({ area: "play", minutes: 0, episodes: 0, finished: 1, titleCount: 1, playMinutes: 22 * 60 });
    expect(cards.play!.titles.map((t) => t.name)).toEqual(["Hades"]);
  });

  it("totals each area apart for the profile's pinned numbers", () => {
    const totals = collectionAreaTotals(shelf, more, logs);
    expect(summarizeCollection(shelf, more, logs).finished).toBe(6); // books and games count as titles finished
    expect(totals.watch).toEqual({ minutes: summarizeCollection(titles, entries, logs).minutes, episodes: summarizeCollection(titles, entries, logs).episodes, finished: 4 });
    expect(totals.read).toMatchObject({ finished: 1, pages: 480 });
    expect(totals.play).toEqual({ minutes: 22 * 60, finished: 1 });
  });

  it("leaves out an area with nothing in it", () => {
    expect(Object.keys(collectionCards(titles, entries, logs, base))).toEqual(["watch"]);
    expect(collectionCards([], [], [], base)).toEqual({});
  });

  it("saves as a stats card; an area only on an all-time card", () => {
    const { read } = collectionCards(shelf, more, logs, base);
    expect(parseRecap(read)).toEqual(read);
    expect(parseRecap({ ...read, period: "year" })).toBeNull();
    expect(parseRecap({ ...read, area: "listen" })).toBeNull();
  });
});

describe("addMonths", () => {
  it("crosses years both ways", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-10", 11)).toBe("2026-09");
  });
});
