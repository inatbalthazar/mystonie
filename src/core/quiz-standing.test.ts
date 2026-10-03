import { describe, expect, it } from "vitest";
import { evaluateBadges, NO_ACTIVITY } from "./badges";
import { nextQuizSticker, NO_STANDING, QUIZ_LADDER, QUIZ_STREAK_DAYS, quizStanding, withHelp, type QuizHelp } from "./quiz-standing";

const day = (d: number, hour = 12) => Date.UTC(2026, 9, d, hour);
const help = (at: number, more: Partial<QuizHelp> = {}): QuizHelp => ({ at, warning: false, settled: false, ...more });

describe("quizStanding", () => {
  it("counts answers, settled questions and warnings", () => {
    const s = quizStanding([help(day(1)), help(day(1, 13), { settled: true }), help(day(2), { warning: true })], "UTC", day(2, 18));
    expect(s).toMatchObject({ answers: 3, settled: 1, warnings: 1 });
  });

  it("counts the streak back from today, or from yesterday while today waits", () => {
    const helps = [help(day(1)), help(day(2)), help(day(2, 20)), help(day(3))];
    expect(quizStanding(helps, "UTC", day(3, 22))).toMatchObject({ streak: 3, today: true });
    expect(quizStanding(helps, "UTC", day(4, 9))).toMatchObject({ streak: 3, today: false });
    expect(quizStanding(helps, "UTC", day(5, 9))).toMatchObject({ streak: 0, today: false });
    expect(quizStanding([], "UTC", day(5))).toEqual(NO_STANDING);
  });

  it("reads days in the user's time zone", () => {
    // 20:00 UTC on the 1st is already the 2nd in Bangkok, so these are two days there and one in UTC.
    const helps = [help(day(1, 10)), help(day(1, 20))];
    expect(quizStanding(helps, "Asia/Bangkok", day(1, 21)).streak).toBe(2);
    expect(quizStanding(helps, "UTC", day(1, 21)).streak).toBe(1);
  });
});

describe("withHelp", () => {
  it("adds an answer and starts or keeps today's streak", () => {
    const waiting = { ...NO_STANDING, answers: 4, streak: 2, today: false };
    const first = withHelp(waiting, { warning: true, settled: false });
    expect(first).toEqual({ answers: 5, settled: 0, warnings: 1, streak: 3, today: true });
    expect(withHelp(first, { warning: false, settled: true })).toEqual({ answers: 6, settled: 1, warnings: 1, streak: 3, today: true });
  });
});

describe("nextQuizSticker", () => {
  it("climbs the answer ladder", () => {
    expect(QUIZ_LADDER.map((s) => s.target)).toEqual([1, 10, 50, 100, 250]);
    expect(nextQuizSticker(0)).toEqual({ id: "spotter", target: 1, progress: 0, from: 0 });
    expect(nextQuizSticker(7)).toEqual({ id: "lookout", target: 10, progress: 7, from: 1 });
    expect(nextQuizSticker(100)).toMatchObject({ id: "lighthouse", from: 100 });
    expect(nextQuizSticker(250)).toBeNull();
  });
});

describe("the quiz stickers", () => {
  const get = (helps: readonly QuizHelp[], zone = "UTC") =>
    evaluateBadges([], [], zone, { ...NO_ACTIVITY, quiz: helps.map((h) => h.at), quizSettles: helps.filter((h) => h.settled).map((h) => h.at) });

  it("gives Spotter for the first answer and Final Say for an answer that settled a question", () => {
    const all = get([help(day(2)), help(day(3), { settled: true })]);
    expect(all.find((b) => b.id === "spotter")).toMatchObject({ earnedAt: day(2) });
    expect(all.find((b) => b.id === "final-say")).toMatchObject({ earnedAt: day(3) });
  });

  it("gives On Duty for a week of days in a row, and a missed day starts over", () => {
    const week = Array.from({ length: QUIZ_STREAK_DAYS }, (_, i) => help(day(10 + i)));
    expect(get(week).find((b) => b.id === "on-duty")).toMatchObject({ progress: 7, earnedAt: day(16) });
    const gap = week.filter((_, i) => i !== 3);
    expect(get(gap).find((b) => b.id === "on-duty")).toMatchObject({ progress: 3, earnedAt: null });
  });
});
