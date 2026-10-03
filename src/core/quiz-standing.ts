// Where someone stands in the warnings quiz (ADR 0094): how many answers they gave, how many questions their answer
// settled, how many warnings they vouched for, their streak of days, and the next sticker on the answer ladder. Made
// from their own answers (the database's clock); the page shows it and adds each new answer to it as it goes.
import { BADGES, type BadgeId } from "./badges";
import { localDateKey } from "./stats/period";
import { addDays } from "./stats/recap";

/** Questions in a round of the quiz page; each round ends with what it did. */
export const QUIZ_ROUND = 5;

/** One answer that counts toward the stickers (yes or no, not too fast), from the user's own rows. */
export type QuizHelp = { at: number; warning: boolean; settled: boolean };

export type QuizStanding = {
  /** Answers that count toward the stickers. */
  answers: number;
  /** Questions their answer settled (the tenth counted one). */
  settled: number;
  /** Answers about someone's scene warning (a vote on it). */
  warnings: number;
  /** Days in a row with an answer, ending today, or yesterday while today's is still to come. */
  streak: number;
  /** Whether today (their time zone) already has an answer. */
  today: boolean;
};

export const NO_STANDING: QuizStanding = { answers: 0, settled: 0, warnings: 0, streak: 0, today: false };

/** The answer stickers, easiest first. */
export const QUIZ_LADDER: readonly { id: BadgeId; target: number }[] = BADGES.flatMap((b) =>
  b.rule.type === "times" && b.rule.of === "quiz" ? [{ id: b.id, target: b.rule.target }] : [],
);

/** Days in a row for the streak sticker. */
export const QUIZ_STREAK_DAYS = BADGES.flatMap((b) => (b.rule.type === "quizStreak" ? [b.rule.target] : []))[0]!;

export function quizStanding(helps: readonly QuizHelp[], timeZone: string, now: number): QuizStanding {
  const days = new Set(helps.map((h) => localDateKey(h.at, timeZone)));
  const todayKey = localDateKey(now, timeZone);
  const today = days.has(todayKey);
  let streak = 0;
  for (let day = today ? todayKey : addDays(todayKey, -1); days.has(day); day = addDays(day, -1)) streak++;
  return {
    answers: helps.length,
    settled: helps.filter((h) => h.settled).length,
    warnings: helps.filter((h) => h.warning).length,
    streak,
    today,
  };
}

/** The standing after one more answer that counts, given now (the page's running total; the server keeps the truth). */
export function withHelp(standing: QuizStanding, help: Omit<QuizHelp, "at">): QuizStanding {
  return {
    answers: standing.answers + 1,
    settled: standing.settled + (help.settled ? 1 : 0),
    warnings: standing.warnings + (help.warning ? 1 : 0),
    streak: standing.today ? standing.streak : standing.streak + 1,
    today: true,
  };
}

/** The next answer sticker still to earn and how far along, or null at the top of the ladder. */
export function nextQuizSticker(answers: number): { id: BadgeId; target: number; progress: number; from: number } | null {
  const index = QUIZ_LADDER.findIndex((step) => answers < step.target);
  if (index < 0) return null;
  const step = QUIZ_LADDER[index]!;
  return { ...step, progress: answers, from: index > 0 ? QUIZ_LADDER[index - 1]!.target : 0 };
}
