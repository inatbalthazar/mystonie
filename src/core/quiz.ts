// The warnings quiz (S3 warnings & quiz, ADR 0043): quick questions about titles someone finished ("Does a dog die in
// Up?"), or about a warning someone else added ("A dog dies · S2 · E5 · 41:10: did you see it?"). The database serves
// each question, times each answer and resolves questions (`quiz_next`, `quiz_answer`); this reads their JSON and the
// answer requests. No Gems: the quiz pays out nothing (they stay gated, ADR 0036).
import { posterUrl } from "./catalog/images";
import { isExternalId, isTitleKind, sourceForKind, type TitleKind } from "./catalog/types";
import { isUuid } from "./email/unsubscribe";
import { isSceneTopic, type ScenePlace, type SceneStatus, type SceneTopicSlug, type SceneUnit } from "./scene-warnings";

/** Answers faster than this after a question is served count for nothing (the database's rule; the UI waits it out). */
export const QUIZ_MIN_ANSWER_MS = 1500;

/** Counted answers that resolve a topic question (yes or no needs at least half and more than the other side). */
export const QUIZ_ANSWERS_TO_RESOLVE = 10;

export const QUIZ_CHOICES = ["yes", "no", "unsure"] as const;
export type QuizChoice = (typeof QUIZ_CHOICES)[number];

export type QuizTitle = { id: string; kind: TitleKind; externalId: string; name: string; year: number | null; posterUrl: string | null };

export type QuizQuestion = {
  status: "question";
  /** The served question (what an answer names). */
  id: string;
  /** "topic": is there <topic> in <title>? "warning": someone noted <topic> at <where>, did you see it? */
  kind: "topic" | "warning";
  topic: SceneTopicSlug;
  title: QuizTitle;
  where: ScenePlace | null;
  /** Counted answers so far (a topic question) or confirmations (a warning). */
  answers: number;
};

export type QuizServe = QuizQuestion | { status: "paused"; until: string } | { status: "no_finishes" } | { status: "done" };

export type QuizResult =
  | {
      status: "counted" | "not_counted";
      kind: "topic" | "warning";
      /** A topic question's state ("open", "yes", "no", "contested") or a warning's status. */
      result: "open" | "yes" | "no" | "contested" | SceneStatus | null;
      yes: number | null;
      no: number | null;
      confirms: number | null;
    }
  | { status: "too_fast" }
  | { status: "paused"; until: string }
  | { status: "answered" }
  | { status: "gone" };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const count = (v: unknown): number | null => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);
const intOrNull = (v: unknown): number | null => (Number.isInteger(v) ? (v as number) : null);
const isTime = (v: unknown): v is string => typeof v === "string" && !Number.isNaN(Date.parse(v));
const UNITS: readonly string[] = ["page", "chapter", "volume"];

function quizTitle(raw: unknown): QuizTitle | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !isUuid(raw.id) || typeof raw.name !== "string") return null;
  if (!isTitleKind(raw.kind) || raw.source !== sourceForKind(raw.kind)) return null;
  const kind = raw.kind;
  if (!isExternalId(kind, raw.externalId)) return null;
  const path = typeof raw.posterPath === "string" ? raw.posterPath : null;
  return { id: raw.id, kind, externalId: raw.externalId, name: raw.name, year: intOrNull(raw.year), posterUrl: posterUrl(sourceForKind(kind), path) };
}

function where(raw: unknown): ScenePlace | null {
  if (!isObject(raw)) return null;
  const unit = typeof raw.unit === "string" && UNITS.includes(raw.unit) ? (raw.unit as SceneUnit) : null;
  return {
    season: intOrNull(raw.season),
    episode: intOrNull(raw.episode),
    startSec: intOrNull(raw.startSec),
    endSec: intOrNull(raw.endSec),
    unit,
    position: unit ? intOrNull(raw.position) : null,
  };
}

/**
 * `quiz_next()`'s JSON → the next question (poster URL made from the catalog path), or null when it's something this
 * app can't show (e.g. a topic added to the database before the app knows its words).
 */
export function parseQuizServe(json: unknown): QuizServe | null {
  if (!isObject(json)) return null;
  if (json.status === "no_finishes" || json.status === "done") return { status: json.status };
  if (json.status === "paused") return isTime(json.until) ? { status: "paused", until: new Date(json.until).toISOString() } : null;
  if (json.status !== "question" || typeof json.id !== "string" || !isUuid(json.id) || !isSceneTopic(json.topic)) return null;
  if (json.kind !== "topic" && json.kind !== "warning") return null;
  const title = quizTitle(json.title);
  if (!title) return null;
  return { status: "question", id: json.id, kind: json.kind, topic: json.topic, title, where: json.kind === "warning" ? where(json.where) : null, answers: count(json.answers) ?? 0 };
}

const RESULTS: readonly string[] = ["open", "yes", "no", "contested", "pending", "confirmed", "disputed"];

/** `quiz_answer()`'s JSON → what happened to the answer, or null. */
export function parseQuizResult(json: unknown): QuizResult | null {
  if (!isObject(json)) return null;
  const { status } = json;
  if (status === "too_fast" || status === "answered" || status === "gone") return { status };
  if (status === "paused") return isTime(json.until) ? { status: "paused", until: new Date(json.until).toISOString() } : null;
  if ((status !== "counted" && status !== "not_counted") || (json.kind !== "topic" && json.kind !== "warning")) return null;
  const result = typeof json.result === "string" && RESULTS.includes(json.result) ? (json.result as Extract<QuizResult, { status: "counted" }>["result"]) : null;
  return { status, kind: json.kind, result, yes: count(json.yes), no: count(json.no), confirms: count(json.confirms) };
}

/** POST /api/quiz body `{ id, choice }`. */
export function parseQuizAnswer(body: unknown): { id: string; choice: QuizChoice } | null {
  if (!isObject(body) || typeof body.id !== "string" || !isUuid(body.id)) return null;
  return (QUIZ_CHOICES as readonly unknown[]).includes(body.choice) ? { id: body.id.toLowerCase(), choice: body.choice as QuizChoice } : null;
}

/** `?title=` on /quiz and GET /api/quiz: a title (our id) to ask about first, e.g. one just finished. */
export function parseQuizTitle(value: string | string[] | null | undefined): string | null {
  return typeof value === "string" && isUuid(value) ? value.toLowerCase() : null;
}
