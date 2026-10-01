// Social (S3 social, ADR 0037): follows, Stamps, blocks, the Following feed, activity and finding people. Server only.
// Everything runs as the signed-in user: RLS and the security definer functions apply visibility and blocks.
import { isBadgeId, type BadgeId } from "@/core/badges";
import { posterUrl } from "@/core/catalog/images";
import type { TitleKind } from "@/core/catalog/types";
import { shownShare } from "@/core/finish-share";
import { uuidv7 } from "@/core/ids";
import { FEED_PAGE, type ActivityItem, type FeedCursor, type FeedItem, type Person } from "@/core/social";
import { publicImageUrl } from "./cards";
import type { Database, TablesInsert } from "./database.types";
import type { UserClient } from "./supabase-server";

/** The outcome of a follow, stamp or block write: "not_found" when the target isn't (or is no longer) allowed. */
export type SocialWrite = "ok" | "not_found";

// Postgres errors from a refused write: RLS (42501), a missing profile or entry (23503), yourself (23514).
const REFUSED = new Set(["42501", "23503", "23514"]);

/** One page of the Following feed: the viewer's finishes and those of the people they follow, newest first. */
export async function followingFeed(db: UserClient, viewerId: string, cursor: FeedCursor | null, limit = FEED_PAGE): Promise<FeedItem[]> {
  const { data, error } = await db.rpc("following_feed", {
    p_before: cursor?.before,
    p_before_id: cursor?.id,
    p_limit: limit,
  });
  if (error) throw new Error(`following_feed failed: ${error.message}`);
  return feedItems(db, viewerId, data);
}

/** Rows of `following_feed` (or `club_feed`, same columns). */
export type FeedRow = Database["public"]["Functions"]["following_feed"]["Returns"][number];

/** Feed rows as feed items, with the stickers each finish earned. */
export async function feedItems(db: UserClient, viewerId: string, data: readonly FeedRow[]): Promise<FeedItem[]> {
  const earned = await feedBadges(db, data);
  // Generated types say non-null; display names, ratings, reviews, years, posters and cards may be null.
  return data.map((r) => ({
    entryId: r.entry_id,
    finishedAt: new Date(r.finished_at).toISOString(),
    rating: r.rating === null ? null : Number(r.rating),
    review: r.review ?? null,
    user: { id: r.user_id, username: r.username, displayName: r.display_name ?? null, avatarUrl: r.avatar_url ?? null },
    title: {
      id: r.title_id,
      kind: r.title_kind as TitleKind,
      externalId: r.title_external_id,
      name: r.title_name,
      year: r.title_year ?? null,
      posterUrl: posterUrl(r.title_source, r.poster_path),
    },
    stampCount: r.stamp_count,
    stamped: r.stamped,
    card: r.card_id ? { id: r.card_id, imageUrl: r.card_image_path ? publicImageUrl(r.card_image_path) : null } : null,
    mine: r.user_id === viewerId,
    badges: earned.get(`${r.user_id}:${r.title_id}`) ?? [],
    finishShare: shownShare(r.finish_share, r.finish_members),
  }));
}

/**
 * The badges earned by these finishes (`user:title` → slugs), read through RLS (the viewer's own and those of
 * public, unblocked profiles). One title has one entry per person, so the pair names the finish. A failure only
 * leaves the stickers off.
 */
async function feedBadges(db: UserClient, rows: readonly { user_id: string; title_id: string }[]): Promise<Map<string, BadgeId[]>> {
  const earned = new Map<string, BadgeId[]>();
  if (rows.length === 0) return earned;
  const { data, error } = await db
    .from("user_badges")
    .select("user_id, title_id, badge")
    .in("user_id", [...new Set(rows.map((r) => r.user_id))])
    .in("title_id", [...new Set(rows.map((r) => r.title_id))])
    .order("earned_at")
    .limit(500);
  if (error) {
    console.error(`user_badges read failed: ${error.message}`);
    return earned;
  }
  for (const row of data) {
    if (!isBadgeId(row.badge)) continue;
    const key = `${row.user_id}:${row.title_id}`;
    earned.set(key, [...(earned.get(key) ?? []), row.badge]);
  }
  return earned;
}

/** Stamps on the viewer's finishes and new followers, newest first. */
export async function myActivity(db: UserClient, limit = 20): Promise<ActivityItem[]> {
  const { data, error } = await db.rpc("my_activity", { p_limit: limit });
  if (error) throw new Error(`my_activity failed: ${error.message}`);
  return data.map((r) => ({
    kind: r.kind === "stamp" ? "stamp" : "follow",
    at: new Date(r.at).toISOString(),
    user: { id: r.user_id, username: r.username, displayName: r.display_name ?? null, avatarUrl: r.avatar_url ?? null },
    iFollow: r.i_follow,
    titleName: r.title_name ?? null,
  }));
}

/** Follower and following counts of a profile the viewer can see, and whether they follow it; null otherwise. */
export async function followCounts(
  db: UserClient,
  userId: string,
): Promise<{ followers: number; following: number; iFollow: boolean } | null> {
  const { data, error } = await db.rpc("follow_counts", { p_user_id: userId });
  if (error) throw new Error(`follow_counts failed: ${error.message}`);
  const row = data[0];
  return row ? { followers: row.followers, following: row.following, iFollow: row.i_follow } : null;
}

/** Public, unblocked people matching a normalized query (`normalizePeopleQuery`). */
export async function searchPeople(db: UserClient, query: string): Promise<Person[]> {
  const { data, error } = await db.rpc("search_people", { p_query: query });
  if (error) throw new Error(`search_people failed: ${error.message}`);
  return data.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name ?? null,
    avatarUrl: r.avatar_url ?? null,
    finished: r.finished,
    iFollow: r.i_follow,
  }));
}

export type FollowedPerson = { id: string; username: string; displayName: string | null; avatarUrl: string | null };

/** The people the viewer follows, newest first. */
export async function myFollowing(db: UserClient): Promise<FollowedPerson[]> {
  const { data, error } = await db.rpc("my_following");
  if (error) throw new Error(`my_following failed: ${error.message}`);
  return data.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name ?? null, avatarUrl: r.avatar_url ?? null }));
}

/** The people the viewer blocked, newest first. */
export async function myBlocks(db: UserClient): Promise<{ id: string; username: string }[]> {
  const { data, error } = await db.rpc("my_blocks");
  if (error) throw new Error(`my_blocks failed: ${error.message}`);
  return data.map((r) => ({ id: r.id, username: r.username }));
}

async function softDelete(query: PromiseLike<{ error: { message: string } | null }>, what: string): Promise<void> {
  const { error } = await query;
  if (error) throw new Error(`${what} update failed: ${error.message}`);
}

/** Inserts a new live row; an existing live one (23505) counts as done. */
export async function insertLive(query: PromiseLike<{ error: { code: string; message: string } | null }>, what: string): Promise<SocialWrite> {
  const { error } = await query;
  if (!error || error.code === "23505") return "ok";
  if (REFUSED.has(error.code)) return "not_found";
  throw new Error(`${what} insert failed: ${error.message}`);
}

/** Follows (a new live row) or unfollows (soft delete) a public profile. */
export async function setFollow(db: UserClient, viewerId: string, userId: string, follow: boolean): Promise<SocialWrite> {
  if (follow) return insertLive(db.from("follows").insert({ id: uuidv7(), followee_id: userId }), "follows");
  await softDelete(
    db.from("follows").update({ deleted_at: new Date().toISOString() }).eq("follower_id", viewerId).eq("followee_id", userId).is("deleted_at", null),
    "follows",
  );
  return "ok";
}

/** Stamps someone's finish, or takes the stamp back. */
export async function setStamp(db: UserClient, viewerId: string, entryId: string, stamped: boolean): Promise<SocialWrite> {
  // owner_id is copied from the entry by a trigger (and isn't insertable), though the generated type requires it.
  if (stamped) return insertLive(db.from("stamps").insert({ id: uuidv7(), entry_id: entryId } as TablesInsert<"stamps">), "stamps");
  await softDelete(
    db.from("stamps").update({ deleted_at: new Date().toISOString() }).eq("user_id", viewerId).eq("entry_id", entryId).is("deleted_at", null),
    "stamps",
  );
  return "ok";
}

/** Blocks someone (which also removes follows and stamps between the two), or unblocks them. */
export async function setBlock(db: UserClient, viewerId: string, userId: string, block: boolean): Promise<SocialWrite> {
  if (block) return insertLive(db.from("blocks").insert({ id: uuidv7(), blocked_id: userId }), "blocks");
  await softDelete(
    db.from("blocks").update({ deleted_at: new Date().toISOString() }).eq("blocker_id", viewerId).eq("blocked_id", userId).is("deleted_at", null),
    "blocks",
  );
  return "ok";
}

/** "What people said" on a title page (ADR 0051): finishes of this title with a written review, newest first. */
export async function titleReviews(db: UserClient, viewerId: string, titleId: string, limit = 20): Promise<FeedItem[]> {
  const { data, error } = await db.rpc("title_reviews", { p_title_id: titleId, p_limit: limit });
  if (error) throw new Error(`title_reviews failed: ${error.message}`);
  return feedItems(db, viewerId, data);
}
