import { describe, expect, it } from "vitest";
import {
  gradeReel,
  isReelReminderHour,
  mergeReelGuesses,
  parseReelGuesses,
  pickReel,
  posterSize,
  posterStep,
  REEL_POOL_PAGES,
  reelCard,
  reelClues,
  reelDay,
  reelHoursLeft,
  reelNumber,
  reelPoolPages,
  reelShareText,
  reelState,
  reelStats,
  streakAfter,
  type ReelAnswer,
  type ReelGuess,
} from "./reel";

const matrix: ReelAnswer = {
  externalId: "603",
  name: "The Matrix",
  year: 1999,
  genres: ["Action", "Science Fiction", "Thriller"],
  actor: "Keanu Reeves",
  director: "Lana Wachowski",
  tagline: "Welcome to the Real World.",
};
const g = (externalId: string, name = `Movie ${externalId}`): ReelGuess => ({ externalId, name });
const reel = { day: "2026-10-05", answer: matrix, posterUrl: "https://image.tmdb.org/t/p/w342/matrix.jpg" };

describe("the day and its number", () => {
  it("is the UTC date, #1 on the epoch", () => {
    expect(reelDay(Date.parse("2026-09-30T23:59:59Z"))).toBe("2026-09-30");
    expect(reelDay(Date.parse("2026-10-01T00:00:00Z"))).toBe("2026-10-01");
    expect(reelNumber("2026-09-30")).toBe(1);
    expect(reelNumber("2026-10-05")).toBe(6);
    expect(reelNumber("2027-09-30")).toBe(366);
  });
});

describe("picking the reel", () => {
  it("looks through every pool page once, starting on the day's own", () => {
    const pages = reelPoolPages("2026-10-05");
    expect(pages).toHaveLength(REEL_POOL_PAGES);
    expect(new Set(pages).size).toBe(REEL_POOL_PAGES);
    expect(Math.min(...pages)).toBe(1);
    expect(reelPoolPages("2026-10-05")).toEqual(pages);
  });

  it("picks the same movie for the same day, never a used one or one without a poster", () => {
    const candidates = ["1", "2", "3", "4"].map((externalId) => ({ externalId, hasPoster: externalId !== "4" }));
    const pick = pickReel(candidates, new Set(["2"]), "2026-10-05");
    expect(pick).toBeTruthy();
    expect(["1", "3"]).toContain(pick);
    expect(pickReel([...candidates].reverse(), new Set(["2"]), "2026-10-05")).toBe(pick);
    expect(pickReel(candidates, new Set(["1", "2", "3"]), "2026-10-05")).toBeNull();
  });
});

describe("guesses", () => {
  it("parses TMDB movie ids, each once, at most six", () => {
    expect(parseReelGuesses([{ externalId: "603", name: " The Matrix " }])).toEqual([g("603", "The Matrix")]);
    expect(parseReelGuesses([])).toEqual([]);
    for (const bad of [null, "x", [{ externalId: "abc", name: "X" }], [{ externalId: "1", name: "" }], [g("1"), g("1")], Array.from({ length: 7 }, (_, i) => g(String(i + 1)))]) {
      expect(parseReelGuesses(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("grades them: a hit ends the play, and anything after it is dropped", () => {
    expect(gradeReel("603", [g("1"), g("603"), g("2")])).toEqual({ results: [false, true], guesses: [g("1"), g("603")], solved: true, done: true });
    expect(gradeReel("603", [g("1"), g("2")])).toMatchObject({ results: [false, false], solved: false, done: false });
    const six = ["1", "2", "3", "4", "5", "6"].map((id) => g(id));
    expect(gradeReel("603", six)).toMatchObject({ solved: false, done: true });
  });

  it("lets a device only add to a signed-in player's stored guesses", () => {
    expect(mergeReelGuesses([g("1")], [g("1"), g("2")], "603")).toEqual([g("1"), g("2")]);
    // Another device is behind, or tries to rewrite the past: the stored guesses win.
    expect(mergeReelGuesses([g("1"), g("2")], [g("1")], "603")).toEqual([g("1"), g("2")]);
    expect(mergeReelGuesses([g("1")], [g("9"), g("2")], "603")).toEqual([g("1")]);
    // A finished play never changes.
    expect(mergeReelGuesses([g("603")], [g("603"), g("2")], "603")).toEqual([g("603")]);
    // A guest who signs in brings their guesses.
    expect(mergeReelGuesses([], [g("1")], "603")).toEqual([g("1")]);
  });
});

describe("clues and the poster", () => {
  it("opens one clue per wrong guess, all of them once done", () => {
    expect(reelClues(matrix, 0, false)).toEqual({});
    expect(reelClues(matrix, 2, false)).toEqual({ year: 1999, genre: "Action · Science Fiction" });
    expect(Object.keys(reelClues(matrix, 5, false))).toEqual(["year", "genre", "actor", "director", "tagline"]);
    expect(Object.keys(reelClues(matrix, 1, true))).toHaveLength(5);
    expect(reelClues({ ...matrix, tagline: null, genres: [] }, 5, false)).toMatchObject({ genre: null, tagline: null });
  });

  it("sharpens the poster with every miss, served small while blurred", () => {
    expect([0, 1, 5, 9].map((w) => posterStep(w, false))).toEqual([0, 1, 5, 5]);
    expect(posterStep(2, true)).toBe(6);
    expect([0, 2, 3, 5, 6].map(posterSize)).toEqual(["w92", "w92", "w185", "w185", "w342"]);
  });

  it("keeps the answer on the server until the play is done", () => {
    const running = reelState(reel, [g("1")]);
    expect(running).toMatchObject({ number: 6, solved: false, done: false, posterStep: 1, answer: null, clues: { year: 1999 } });
    expect(JSON.stringify(running)).not.toContain("Matrix");
    const solved = reelState(reel, [g("1"), g("603", "The Matrix")]);
    expect(solved.answer).toEqual({ externalId: "603", name: "The Matrix", year: 1999, posterUrl: reel.posterUrl });
    expect(solved.guesses.map((x) => x.correct)).toEqual([false, true]);
  });
});

describe("streaks, stats and sharing", () => {
  it("counts a streak of wins on consecutive days", () => {
    expect(streakAfter(true, { day: "2026-10-04", solved: true, streak: 3 }, "2026-10-05")).toBe(4);
    expect(streakAfter(true, { day: "2026-10-03", solved: true, streak: 3 }, "2026-10-05")).toBe(1);
    expect(streakAfter(true, { day: "2026-10-04", solved: false, streak: 0 }, "2026-10-05")).toBe(1);
    expect(streakAfter(true, null, "2026-10-05")).toBe(1);
    expect(streakAfter(false, { day: "2026-10-04", solved: true, streak: 3 }, "2026-10-05")).toBe(0);
  });

  it("sums a player's plays", () => {
    const plays = [
      { day: "2026-10-01", solved: true, guesses: 2 },
      { day: "2026-10-02", solved: true, guesses: 4 },
      { day: "2026-10-03", solved: true, guesses: 1 },
      { day: "2026-10-04", solved: false, guesses: 6 },
      { day: "2026-10-06", solved: true, guesses: 2 },
      { day: "2026-10-07", solved: true, guesses: 3 },
    ];
    expect(reelStats(plays, "2026-10-07")).toEqual({ played: 6, won: 5, streak: 2, maxStreak: 3, distribution: [1, 2, 1, 1, 0, 0] });
    // Not played today yet: yesterday's streak still stands; a day missed ends it.
    expect(reelStats(plays, "2026-10-08").streak).toBe(2);
    expect(reelStats(plays, "2026-10-09").streak).toBe(0);
    expect(reelStats([], "2026-10-09")).toMatchObject({ played: 0, streak: 0, maxStreak: 0 });
  });

  it("shares the squares, never the answer", () => {
    const card = reelCard(reelState(reel, [g("1"), g("2"), g("603", "The Matrix")]), 4)!;
    expect(card).toEqual({ number: 6, day: "2026-10-05", results: [false, false, true], solved: true, streak: 4 });
    const text = reelShareText(card, "https://mystonie.com/reel", "Reel of the Day");
    expect(text).toBe("Reel of the Day #6 3/6\n🟥🟥🟩\n🔥 4\nhttps://mystonie.com/reel");
    expect(text).not.toContain("Matrix");
    const lost = reelCard(reelState(reel, ["1", "2", "3", "4", "5", "6"].map((id) => g(id))), 0)!;
    expect(reelShareText(lost, "u", "R")).toBe("R #6 X/6\n🟥🟥🟥🟥🟥🟥\nu");
    expect(reelCard(reelState(reel, [g("1")]), 0)).toBeNull();
  });
});

describe("streak reminders", () => {
  const at = (iso: string) => Date.parse(iso);
  const hours = (timeZone: string, day = "2026-10-05") =>
    Array.from({ length: 24 }, (_, h) => h).filter((h) => isReelReminderHour(at(`${day}T${String(h).padStart(2, "0")}:05:00Z`), timeZone));

  it("comes once a day, at the last daytime hour before the reel changes", () => {
    expect(hours("Asia/Bangkok")).toEqual([14]); // 21:05, the reel changes at 07:00
    expect(hours("Asia/Tokyo")).toEqual([12]); // 21:05
    expect(hours("Europe/London")).toEqual([20]); // 21:05 in summer time
    expect(hours("UTC")).toEqual([21]);
    expect(hours("America/New_York")).toEqual([21]); // 17:05, the reel changes at 20:00
    expect(hours("America/Los_Angeles")).toEqual([21]); // 14:05
    expect(hours("Pacific/Auckland", "2027-01-05")).toEqual([21]); // 10:05 the next morning, the reel changes at 13:00
    expect(hours("Asia/Kolkata")).toEqual([16]); // 21:35
  });

  it("follows daylight saving time", () => {
    expect(hours("Europe/London", "2027-01-05")).toEqual([21]); // 21:05 in winter
    expect(hours("America/New_York", "2027-01-05")).toEqual([21]); // 16:05
  });

  it("reads an unknown zone as UTC", () => {
    expect(hours("Mars/Olympus")).toEqual([21]);
  });

  it("counts the hours left", () => {
    expect(reelHoursLeft(at("2026-10-05T14:05:00Z"))).toBe(9);
    expect(reelHoursLeft(at("2026-10-05T21:05:00Z"))).toBe(2);
    expect(reelHoursLeft(at("2026-10-05T23:59:00Z"))).toBe(1);
  });
});
