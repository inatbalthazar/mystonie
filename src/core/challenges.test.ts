import { describe, expect, it } from "vitest";
import type { TitleKind } from "./catalog/types";
import {
  CHALLENGE_SLUGS,
  challengeCardData,
  challengeUnit,
  currentMonth,
  daysLeft,
  evaluateChallenges,
  findChallenge,
  isChallengeSlug,
  monthChallenges,
  parseChallengeToggle,
  type ChallengeProgress,
  type ChallengeTitle,
} from "./challenges";
import type { StatsReadingLog } from "./stats/reading";
import type { StatsEntry, StatsEpisodeLog } from "./stats/summary";

let n = 0;
function title(kind: TitleKind, extra: Partial<ChallengeTitle> = {}): ChallengeTitle {
  n += 1;
  return {
    id: `t${String(n).padStart(3, "0")}`,
    kind,
    name: `Title ${n}`,
    posterUrl: null,
    genres: [],
    originalLanguage: "en",
    runtimeMin: kind === "movie" ? 120 : 45,
    episodeCount: kind === "series" ? 10 : null,
    ...extra,
  };
}
const finish = (t: ChallengeTitle, finishedAt: string, extra: Partial<StatsEntry> = {}): StatsEntry => ({ id: `e-${t.id}`, titleId: t.id, status: "finished", finishedAt, ...extra });
const episode = (t: ChallengeTitle, watchedAt: string, i = 0): StatsEpisodeLog => ({ id: `l-${t.id}-${i}`, titleId: t.id, runtimeMin: 45, watchedAt });
const read = (t: ChallengeTitle, readAt: string, position: number): StatsReadingLog => ({ id: `r-${t.id}-${position}`, titleId: t.id, unit: "page", position, readAt });
const oct = (d: number, h = 12) => `2026-10-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;
const get = (all: ChallengeProgress[], slug: string) => all.find((c) => c.slug === slug)!;
const rows = (titles: ChallengeTitle[], entries: StatsEntry[] = [], logs: StatsEpisodeLog[] = [], reads: StatsReadingLog[] = []) => ({ titles, entries, logs, reads });

describe("the lineup", () => {
  it("has the month's themed challenge first, then the three of every month", () => {
    expect(monthChallenges("2026-10").map((c) => c.slug)).toEqual(["fright-month", "finish-four", "twenty-hours", "twelve-days"]);
    expect(monthChallenges("2027-01")[0]!.slug).toBe("new-chapter");
    expect(monthChallenges("2026-13")).toEqual([]);
    expect(monthChallenges("oct")).toEqual([]);
  });

  it("gives every month a different themed challenge, and every slug is known", () => {
    const themed = Array.from({ length: 12 }, (_, i) => monthChallenges(`2026-${String(i + 1).padStart(2, "0")}`)[0]!.slug);
    expect(new Set(themed).size).toBe(12);
    for (const slug of themed) expect(isChallengeSlug(slug)).toBe(true);
    expect(CHALLENGE_SLUGS).toHaveLength(15);
  });

  it("finds a challenge only in its own month", () => {
    expect(findChallenge("2026-10", "fright-month")?.rule).toMatchObject({ type: "finish", target: 3 });
    expect(findChallenge("2026-11", "fright-month")).toBeNull();
    expect(findChallenge("2026-11", "finish-four")).not.toBeNull();
  });

  it("names what each rule counts", () => {
    expect(challengeUnit(findChallenge("2026-10", "finish-four")!.rule)).toBe("titles");
    expect(challengeUnit(findChallenge("2026-03", "world-tour")!.rule)).toBe("languages");
    expect(challengeUnit(findChallenge("2026-12", "triple-threat")!.rule)).toBe("kinds");
    expect(challengeUnit(findChallenge("2026-10", "twenty-hours")!.rule)).toBe("hours");
    expect(challengeUnit(findChallenge("2026-10", "twelve-days")!.rule)).toBe("days");
  });
});

describe("months in the user's time zone", () => {
  it("knows which month it is there, and how many days are left", () => {
    const now = Date.parse("2026-10-31T20:00:00Z");
    expect(currentMonth(now, "UTC")).toBe("2026-10");
    expect(currentMonth(now, "Asia/Bangkok")).toBe("2026-11");
    expect(daysLeft("2026-10", now, "UTC")).toBe(1);
    expect(daysLeft("2026-11", now, "Asia/Bangkok")).toBe(30);
    expect(daysLeft("2026-10", now, "Asia/Bangkok")).toBe(0);
  });
});

describe("evaluateChallenges", () => {
  it("counts finishes in the month, with the finish that met the target", () => {
    const films = Array.from({ length: 5 }, () => title("movie"));
    const entries = [finish(films[0]!, "2026-09-30T12:00:00Z"), ...films.slice(1).map((f, i) => finish(f, oct(i + 2)))];
    const { progress } = evaluateChallenges("2026-10", "UTC", rows(films, entries));
    expect(get(progress, "finish-four")).toEqual({ slug: "finish-four", target: 4, value: 4, done: true, doneAt: Date.parse(oct(5)), titleId: films[4]!.id });
  });

  it("stops short without enough, and ignores deleted entries and other statuses", () => {
    const films = Array.from({ length: 4 }, () => title("movie"));
    const entries = [
      finish(films[0]!, oct(1)),
      finish(films[1]!, oct(2)),
      finish(films[2]!, oct(3), { deletedAt: oct(4) }),
      { id: "w", titleId: films[3]!.id, status: "watching" as const, finishedAt: null },
    ];
    expect(get(evaluateChallenges("2026-10", "UTC", rows(films, entries)).progress, "finish-four")).toMatchObject({ value: 2, done: false, titleId: null });
  });

  it("filters the themed challenge by genre", () => {
    const scary = [title("movie", { genres: ["Horror"] }), title("series", { genres: ["Mystery", "Horror"] }), title("book", { genres: ["horror"] })];
    const other = title("movie", { genres: ["Comedy"] });
    const entries = [...scary, other].map((t, i) => finish(t, oct(i + 1)));
    expect(get(evaluateChallenges("2026-10", "UTC", rows([...scary, other], entries)).progress, "fright-month")).toMatchObject({ value: 3, done: true, titleId: scary[2]!.id });
  });

  it("counts the month in the user's time zone", () => {
    const film = title("movie");
    // 31 Oct 20:00 UTC is already November in Bangkok.
    const entries = [finish(film, "2026-10-31T20:00:00Z")];
    expect(get(evaluateChallenges("2026-10", "UTC", rows([film], entries)).progress, "finish-four").value).toBe(1);
    expect(get(evaluateChallenges("2026-10", "Asia/Bangkok", rows([film], entries)).progress, "finish-four").value).toBe(0);
    expect(get(evaluateChallenges("2026-11", "Asia/Bangkok", rows([film], entries)).progress, "finish-four").value).toBe(1);
  });

  it("counts distinct days with anything logged, and returns them for the calendar", () => {
    const show = title("series");
    const book = title("book", { pageCount: 300 });
    const logs = [episode(show, oct(1), 1), episode(show, oct(1, 20), 2), episode(show, oct(3), 3)];
    const reads = [read(book, oct(5), 40), read(book, "2026-09-20T12:00:00Z", 10)];
    const { progress, days } = evaluateChallenges("2026-10", "UTC", rows([show, book], [finish(show, oct(9))], logs, reads));
    expect(days).toEqual([1, 3, 5, 9]);
    expect(get(progress, "twelve-days")).toMatchObject({ value: 4, done: false });
  });

  it("meets the days challenge on the 12th different day", () => {
    const show = title("series");
    const logs = Array.from({ length: 14 }, (_, i) => episode(show, oct(i + 1), i));
    expect(get(evaluateChallenges("2026-10", "UTC", rows([show], [], logs)).progress, "twelve-days")).toMatchObject({ value: 12, done: true, doneAt: Date.parse(oct(12)) });
  });

  it("counts hours like the recap cards: watch time plus estimated reading time", () => {
    const films = Array.from({ length: 11 }, () => title("movie", { runtimeMin: 120 }));
    const entries = films.map((f, i) => finish(f, oct(i + 1)));
    const hours = get(evaluateChallenges("2026-10", "UTC", rows(films, entries)).progress, "twenty-hours");
    expect(hours).toMatchObject({ value: 20, done: true, titleId: films[10]!.id });
    const few = get(evaluateChallenges("2026-10", "UTC", rows(films.slice(0, 3), entries.slice(0, 3))).progress, "twenty-hours");
    expect(few).toMatchObject({ value: 6, done: false });
  });

  it("counts distinct languages and kinds", () => {
    const titles = [title("movie", { originalLanguage: "ko" }), title("series", { originalLanguage: "KO" }), title("book", { originalLanguage: "ja" }), title("manga", { originalLanguage: null })];
    const entries = titles.map((t, i) => finish(t, `2026-03-${String(i + 1).padStart(2, "0")}T12:00:00Z`));
    const march = evaluateChallenges("2026-03", "UTC", rows(titles, entries)).progress;
    expect(get(march, "world-tour")).toMatchObject({ value: 2, done: false });
    const december = evaluateChallenges("2026-12", "UTC", rows(titles, entries.map((e) => ({ ...e, finishedAt: e.finishedAt!.replace("2026-03", "2026-12") })))).progress;
    expect(get(december, "triple-threat")).toMatchObject({ value: 3, done: true, titleId: titles[2]!.id });
  });

  it("returns the whole lineup, and nothing for a bad month", () => {
    expect(evaluateChallenges("2026-10", "UTC", rows([])).progress.map((p) => p.slug)).toEqual(["fright-month", "finish-four", "twenty-hours", "twelve-days"]);
    expect(evaluateChallenges("nope", "UTC", rows([]))).toEqual({ progress: [], days: [] });
  });
});

describe("challengeCardData", () => {
  it("puts the completing title's poster on the month's calendar", () => {
    const card = challengeCardData({ slug: "finish-four", target: 4 }, "2026-10", [1, 5], { kind: "series", name: "Dark", posterUrl: null }, "2026-10-05");
    expect(card).toEqual({ kind: "series", name: "Dark", posterUrl: null, finishedOn: "2026-10-05", challenge: { slug: "finish-four", month: "2026-10", target: 4, days: [1, 5] } });
  });
});

describe("parseChallengeToggle", () => {
  it("takes a challenge of that month's lineup", () => {
    expect(parseChallengeToggle({ month: "2026-10", slug: "fright-month", join: true })).toEqual({ month: "2026-10", slug: "fright-month", on: true });
    expect(parseChallengeToggle({ month: "2026-11", slug: "fright-month", join: true })).toBeNull();
    expect(parseChallengeToggle({ month: "2026-10", slug: "finish-four", join: "yes" })).toBeNull();
    expect(parseChallengeToggle({ month: "2026-1", slug: "finish-four", join: true })).toBeNull();
    expect(parseChallengeToggle(null)).toBeNull();
  });
});
