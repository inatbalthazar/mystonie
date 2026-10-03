// Scene warnings and the warnings quiz (S3 warnings & quiz, ADR 0043). Server only, as the signed-in user: RLS and the
// security definer functions decide who may add, vote and answer, and the database alone sets statuses and resolves
// questions. Nothing here talks to DoesTheDogDie.
import { uuidv7 } from "@/core/ids";
import { parseQuizResult, parseQuizServe, type QuizChoice, type QuizResult, type QuizServe } from "@/core/quiz";
import {
  isSceneTopic,
  SCENE_TOPICS,
  type NewSceneWarning,
  type SceneStatus,
  type SceneTopicSlug,
  type SceneUnit,
  type SceneWarning,
  type TopicVerdict,
} from "@/core/scene-warnings";
import type { UserClient } from "./supabase-server";

const STATUSES: readonly string[] = ["pending", "confirmed", "disputed"];
const UNITS: readonly string[] = ["page", "chapter", "volume"];
const vote = (v: number | null | undefined): 1 | -1 | null => (v === 1 || v === -1 ? v : null);

/** A title's warnings for its page, in viewing order: pending and confirmed ones (disputed ones only to their adder). */
export async function titleSceneWarnings(db: UserClient, titleId: string): Promise<SceneWarning[]> {
  const { data, error } = await db.rpc("title_scene_warnings", { p_title_id: titleId });
  if (error) throw new Error(`title_scene_warnings failed: ${error.message}`);
  // Generated types say non-null; every place column may be null. Topics the app doesn't know yet are left out.
  return (data ?? []).flatMap((r) =>
    isSceneTopic(r.topic) && STATUSES.includes(r.status)
      ? [
          {
            id: r.id,
            topic: r.topic,
            season: r.season ?? null,
            episode: r.episode ?? null,
            startSec: r.start_sec ?? null,
            endSec: r.end_sec ?? null,
            unit: r.unit && UNITS.includes(r.unit) ? (r.unit as SceneUnit) : null,
            position: r.position ?? null,
            status: r.status as SceneStatus,
            confirms: r.confirms,
            disputes: r.disputes,
            createdAt: new Date(r.created_at).toISOString(),
            mine: r.mine,
            myVote: vote(r.my_vote),
          },
        ]
      : [],
  );
}

/** What the quiz settled about a title: each topic ten people who finished it answered (yes, no, or they disagreed). */
export async function titleVerdicts(db: UserClient, titleId: string): Promise<TopicVerdict[]> {
  const { data, error } = await db
    .from("quiz_questions")
    .select("topic, status, yes_count, no_count")
    .eq("title_id", titleId)
    .neq("status", "open")
    .order("topic");
  if (error) throw new Error(`quiz_questions read failed: ${error.message}`);
  return (data ?? []).flatMap((r) =>
    isSceneTopic(r.topic) && (r.status === "yes" || r.status === "no" || r.status === "contested")
      ? [{ topic: r.topic, result: r.status, yes: r.yes_count, no: r.no_count }]
      : [],
  );
}

export type AddedWarning = { warning: SceneWarning } | { error: "not_seen" | "duplicate" | "daily_limit" | "invalid" };

/**
 * Adds a warning as the user. The database checks the rest: that they're watching or finished the title ("not_seen"),
 * that the topic and place suit its kind ("invalid"), the same warning twice ("duplicate"), 30 a day ("daily_limit").
 */
export async function addSceneWarning(db: UserClient, input: NewSceneWarning): Promise<AddedWarning> {
  const { data, error } = await db
    .from("scene_warnings")
    .insert({
      id: input.id,
      title_id: input.titleId,
      topic: input.topic,
      season: input.season,
      episode: input.episode,
      start_sec: input.startSec,
      end_sec: input.endSec,
      unit: input.unit,
      position: input.position,
    })
    .select("status, confirms, disputes, created_at")
    .single();
  if (error) {
    if (error.code === "42501") return { error: "not_seen" };
    if (error.code === "23505") return { error: "duplicate" };
    if (error.code === "23514" && error.hint === "daily_limit") return { error: "daily_limit" };
    if (error.code === "23514" || error.code === "23503" || error.code === "22P02") return { error: "invalid" };
    throw new Error(`scene_warnings insert failed: ${error.message}`);
  }
  return {
    warning: {
      id: input.id,
      topic: input.topic,
      season: input.season,
      episode: input.episode,
      startSec: input.startSec,
      endSec: input.endSec,
      unit: input.unit,
      position: input.position,
      status: data.status as SceneStatus,
      confirms: data.confirms,
      disputes: data.disputes,
      createdAt: new Date(data.created_at).toISOString(),
      mine: true,
      myVote: null,
    },
  };
}

/** Withdraws the user's own warning while it waits for confirmations; false when there's no such warning (any more). */
export async function withdrawSceneWarning(db: UserClient, userId: string, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("scene_warnings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`scene_warnings withdraw failed: ${error.message}`);
  return (data ?? []).length > 0;
}

export type Tally = { status: SceneStatus; confirms: number; disputes: number; myVote: 1 | -1 | null };

/** A warning's totals and the user's vote, as others see them now (null: gone, or disputed and not theirs). */
async function tally(db: UserClient, warningId: string): Promise<Tally | null> {
  const { data, error } = await db.rpc("scene_warning_tally", { p_warning_id: warningId });
  if (error) throw new Error(`scene_warning_tally failed: ${error.message}`);
  const row = data?.[0];
  return row && STATUSES.includes(row.status)
    ? { status: row.status as SceneStatus, confirms: row.confirms, disputes: row.disputes, myVote: vote(row.my_vote) }
    : null;
}

/**
 * Votes on someone else's warning (1 saw it, -1 not there) or takes the vote back (0), then returns the new totals.
 * "not_found" when the user may not vote on it: their own, gone, or a title they haven't watched or read.
 */
export async function voteSceneWarning(db: UserClient, userId: string, warningId: string, choice: 1 | -1 | 0): Promise<Tally | "not_found"> {
  const { data: current, error: readError } = await db
    .from("scene_warning_votes")
    .select("id, vote")
    .eq("user_id", userId)
    .eq("warning_id", warningId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) throw new Error(`scene_warning_votes read failed: ${readError.message}`);

  let error: { code: string; message: string } | null = null;
  if (choice === 0) {
    if (current) ({ error } = await db.from("scene_warning_votes").update({ deleted_at: new Date().toISOString() }).eq("id", current.id));
  } else if (current) {
    if (current.vote !== choice) ({ error } = await db.from("scene_warning_votes").update({ vote: choice }).eq("id", current.id));
  } else {
    ({ error } = await db.from("scene_warning_votes").insert({ id: uuidv7(), warning_id: warningId, vote: choice }));
    // 23505: a request racing this one voted first; change that vote instead.
    if (error?.code === "23505") {
      ({ error } = await db.from("scene_warning_votes").update({ vote: choice }).eq("user_id", userId).eq("warning_id", warningId).is("deleted_at", null));
    }
  }
  if (error) {
    if (error.code === "42501" || error.code === "23503") return "not_found";
    throw new Error(`scene_warning_votes write failed: ${error.message}`);
  }
  return (await tally(db, warningId)) ?? "not_found";
}

/** For each of `titleIds`, the user's avoid-topics (DTDD ids) that a confirmed warning or a quiz "yes" puts in it. */
export async function communityAvoidHits(db: UserClient, titleIds: readonly string[]): Promise<Map<string, number[]>> {
  const hits = new Map<string, number[]>();
  if (titleIds.length === 0) return hits;
  const { data, error } = await db.rpc("community_avoid_hits", { p_title_ids: [...titleIds] });
  if (error) {
    console.error("community_avoid_hits failed", error.message);
    return hits;
  }
  for (const row of data ?? []) hits.set(row.title_id, [...(hits.get(row.title_id) ?? []), row.topic_id]);
  return hits;
}

/** The topics this app has words for: the quiz asks only about these (a topic added to the database first waits). */
const KNOWN_TOPICS = SCENE_TOPICS.map((t) => t.slug);

/** The user's next quiz question (about `titleId` first, when given). Throws when the database fails or answers oddly. */
export async function quizNext(db: UserClient, titleId: string | null): Promise<QuizServe> {
  const { data, error } = await db.rpc("quiz_next", { p_topics: KNOWN_TOPICS, ...(titleId ? { p_title_id: titleId } : {}) });
  if (error) throw new Error(`quiz_next failed: ${error.message}`);
  const served = parseQuizServe(data);
  if (!served) throw new Error("quiz_next answered something this app can't show");
  if (served.status !== "question") return served;
  return { ...served, avoiders: await topicAvoiders(db, served.topic) };
}

/**
 * How many people avoid a topic, not counting the user (ADR 0094; 0 under 3). Never throws: the question matters more
 * than the count, and a database without `topic_avoiders` yet (the migration not applied) answers 0.
 */
export async function topicAvoiders(db: UserClient, topic: SceneTopicSlug): Promise<number> {
  const { data, error } = await db.rpc("topic_avoiders", { p_topic: topic });
  if (error) {
    console.error(`topic_avoiders failed: ${error.message}`);
    return 0;
  }
  return typeof data === "number" && Number.isInteger(data) && data > 0 ? data : 0;
}

/** Answers a served question as the user; the database times it and counts it (or not). */
export async function quizAnswer(db: UserClient, id: string, choice: QuizChoice): Promise<QuizResult> {
  const { data, error } = await db.rpc("quiz_answer", { p_id: id, p_choice: choice });
  if (error) throw new Error(`quiz_answer failed: ${error.message}`);
  const result = parseQuizResult(data);
  if (!result) throw new Error("quiz_answer answered something this app can't read");
  return result;
}
