// Content warnings (S2, ADR 0035): DTDD's votes cached per title in `title_warnings`, the user's avoid-topics
// (`user_avoid_topics`) and the badges they cause. Only the title page and `/api/warnings/*` call DTDD; badges read
// the cache alone.
import { after } from "next/server";
import { dtddMediaUrl, warningVerdict, type TitleWarnings, type WarningTitle } from "@/core/catalog/dtdd";
import type { TmdbKind } from "@/core/catalog/tmdb";
import type { Title } from "@/core/catalog/types";
import { uuidv7 } from "@/core/ids";
import { mergeBadgeTopics, type BadgeTopic } from "@/core/warnings";
import { dtddProvider } from "./dtdd";
import { communityAvoidHits } from "./scene-warnings";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

/** Cached votes are refreshed after this long (the spec: 7 days; DTDD's terms: at least every 30). */
export const WARNINGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Admin = NonNullable<ReturnType<typeof adminClient>>;

/** Looks the title up again and rewrites its cache. Throws when DTDD fails (the old cache then stays). */
async function refresh(db: Admin | null, titleId: string, title: WarningTitle): Promise<TitleWarnings> {
  const result = await dtddProvider.lookup(title);
  if (!db) return result;
  const now = new Date().toISOString();
  if (result.status === "matched" && result.topics.length > 0) {
    const { error } = await db.from("title_warnings").upsert(
      result.topics.map((t) => ({
        title_id: titleId,
        topic_id: t.id,
        topic_name: t.name,
        category: t.category,
        spoiler: t.spoiler,
        yes_count: t.yes,
        no_count: t.no,
        comment: t.comment,
        fetched_at: now,
      })),
    );
    if (error) {
      console.error("title_warnings upsert failed", error.message);
      return result; // leave the title unchecked, so the next view tries again
    }
  }
  // Topics nobody votes on any more (or everything, when the match went away).
  const { error: pruneError } = await db.from("title_warnings").delete().eq("title_id", titleId).lt("fetched_at", now);
  if (pruneError) console.error("title_warnings prune failed", pruneError.message);
  const { error } = await db
    .from("titles")
    .update({ dtdd_id: result.status === "matched" ? result.sourceId : null, dtdd_checked_at: now })
    .eq("id", titleId);
  if (error) console.error("titles dtdd update failed", error.message);
  return result;
}

/**
 * What DTDD says about a movie or series, or null when DTDD failed and nothing is cached. A cache younger than
 * 7 days is used as is; an older one is shown while it refreshes after the response (stale-while-revalidate).
 */
export async function titleWarnings(titleId: string, title: Title & { kind: TmdbKind }): Promise<TitleWarnings | null> {
  const db = adminClient();
  const target: WarningTitle = {
    kind: title.kind,
    externalId: title.externalId,
    name: title.name,
    originalName: title.originalName,
    year: title.year,
    imdbId: null,
  };
  if (db) {
    const [{ data: row, error }, { data: rows, error: rowsError }] = await Promise.all([
      db.from("titles").select("dtdd_id, dtdd_checked_at, imdb:raw->>imdb_id").eq("id", titleId).maybeSingle(),
      db.from("title_warnings").select("topic_id, topic_name, category, spoiler, yes_count, no_count, comment").eq("title_id", titleId),
    ]);
    if (error || rowsError) console.error("warnings read failed", (error ?? rowsError)?.message);
    if (typeof row?.imdb === "string" && /^tt\d{5,10}$/.test(row.imdb)) target.imdbId = row.imdb;
    if (row?.dtdd_checked_at && rows) {
      const cached: TitleWarnings = row.dtdd_id
        ? {
            status: "matched",
            sourceId: row.dtdd_id,
            sourceUrl: dtddMediaUrl(row.dtdd_id),
            topics: rows.map((r) => ({
              id: r.topic_id,
              name: r.topic_name,
              category: r.category,
              spoiler: r.spoiler,
              yes: r.yes_count,
              no: r.no_count,
              comment: r.comment,
            })),
          }
        : { status: "unmatched" };
      if (Date.now() - Date.parse(row.dtdd_checked_at) > WARNINGS_TTL_MS) {
        after(() => refresh(db, titleId, target).catch((e) => console.warn("warnings refresh failed", e instanceof Error ? e.message : e)));
      }
      return cached;
    }
  }
  try {
    return await refresh(db, titleId, target);
  } catch (e) {
    console.warn("warnings lookup failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** The signed-in user's live avoid-topics (DTDD topic ids), oldest first. */
export async function avoidTopicIds(db: UserClient, userId: string): Promise<number[]> {
  const { data, error } = await db
    .from("user_avoid_topics")
    .select("topic_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at")
    .order("topic_id");
  if (error) console.error("user_avoid_topics read failed", error.message);
  return (data ?? []).map((r) => r.topic_id);
}

/**
 * Replaces the user's avoid-topics with `topicIds`: topics no longer chosen are soft-deleted, new ones get a row
 * (UUID v7, day-one rules). A topic chosen again later is a new row.
 */
export async function saveAvoidTopics(db: UserClient, userId: string, topicIds: readonly number[]): Promise<void> {
  const keep = [...new Set(topicIds)];
  const current = await avoidTopicIds(db, userId);
  const drop = current.filter((id) => !keep.includes(id));
  const add = keep.filter((id) => !current.includes(id));
  if (drop.length > 0) {
    const { error } = await db
      .from("user_avoid_topics")
      .update({ deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("topic_id", drop);
    if (error) throw new Error(`user_avoid_topics update failed: ${error.message}`);
  }
  if (add.length === 0) return;
  const { error } = await db.from("user_avoid_topics").insert(add.map((topic_id) => ({ id: uuidv7(), user_id: userId, topic_id })));
  // 23505: a request racing this one added the same topic first, which is what was asked for.
  if (error && error.code !== "23505") throw new Error(`user_avoid_topics insert failed: ${error.message}`);
}

/**
 * Warning badges: for each of `titleIds` with a Yes for one of the user's avoid-topics, those topics. A Yes is DTDD's
 * (by the rule, from the cache only: a title nobody has opened yet has none) or our own (a confirmed scene warning or a
 * quiz "yes", S3 warnings & quiz).
 */
export async function avoidBadges(db: UserClient, titleIds: readonly string[]): Promise<Map<string, BadgeTopic[]>> {
  const badges = new Map<string, BadgeTopic[]>();
  if (titleIds.length === 0) return badges;
  const [{ data, error }, ours] = await Promise.all([db.rpc("avoid_warnings", { p_title_ids: [...titleIds] }), communityAvoidHits(db, titleIds)]);
  if (error) console.error("avoid_warnings failed", error.message);
  const dtdd = new Map<string, BadgeTopic[]>();
  for (const row of data ?? []) {
    if (warningVerdict(row.yes_count, row.no_count) !== "yes") continue;
    dtdd.set(row.title_id, [...(dtdd.get(row.title_id) ?? []), { id: row.topic_id, name: row.topic_name }]);
  }
  for (const id of new Set([...dtdd.keys(), ...ours.keys()])) badges.set(id, mergeBadgeTopics(dtdd.get(id) ?? [], ours.get(id) ?? []));
  return badges;
}
