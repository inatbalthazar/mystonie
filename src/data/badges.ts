// Badges (S3 badges & shelf, ADR 0038). The rules are src/core/badges.ts; awards are written with the service role
// only, after evaluating the user's own rows, so no client can give itself a sticker. Reads go through RLS: your
// own badges, or those of a public, unblocked profile.
import {
  albumBadges,
  badgesToAward,
  badgesToCelebrate,
  evaluateBadges,
  isBadgeId,
  type AlbumBadge,
  type BadgeId,
  type BadgeProgress,
  type EarnedBadge,
} from "@/core/badges";
import { uuidv7 } from "@/core/ids";
import type { StatsRows } from "./stats";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

export type UserBadge = { id: BadgeId; earnedAt: string; titleId: string | null; titleName: string | null };

/** A user's badges, newest first (unknown slugs from an older catalogue are skipped). */
export async function userBadges(db: UserClient, userId: string): Promise<UserBadge[]> {
  const { data, error } = await db
    .from("user_badges")
    .select("badge, earned_at, title_id, title:titles(name)")
    .eq("user_id", userId)
    .order("earned_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`user_badges read failed: ${error.message}`);
  return data.flatMap((row) =>
    isBadgeId(row.badge) ? [{ id: row.badge, earnedAt: row.earned_at, titleId: row.title_id, titleName: row.title?.name ?? null }] : [],
  );
}

/**
 * Evaluates the badges from `rows` (the user's own, from `statsRows`) and awards the earned ones not awarded yet.
 * Returns the whole album (`progress`), the badges this call awarded (a concurrent call can't award one twice:
 * the insert skips existing pairs and only returns its own rows) and which of those to celebrate. Without the
 * service role key nothing is awarded.
 */
export async function syncBadges(
  db: UserClient,
  userId: string,
  rows: Pick<StatsRows, "titles" | "entries">,
  timeZone: string,
  now: number,
): Promise<{ progress: BadgeProgress[]; awarded: EarnedBadge[]; celebrate: EarnedBadge[] }> {
  const progress = evaluateBadges(rows.titles, rows.entries, timeZone);
  const { data: existing, error } = await db.from("user_badges").select("badge").eq("user_id", userId).limit(200);
  if (error) throw new Error(`user_badges read failed: ${error.message}`);
  const had = new Set(existing.map((row) => row.badge));
  const toAward = badgesToAward(progress, had);
  const admin = toAward.length > 0 ? adminClient() : null;
  if (!admin) return { progress, awarded: [], celebrate: [] };

  const { data: inserted, error: insertError } = await admin
    .from("user_badges")
    .upsert(
      toAward.map((b) => ({ id: uuidv7(), user_id: userId, badge: b.id, earned_at: new Date(b.earnedAt).toISOString(), title_id: b.titleId })),
      { onConflict: "user_id,badge", ignoreDuplicates: true },
    )
    .select("badge");
  if (insertError) throw new Error(`user_badges insert failed: ${insertError.message}`);
  const mine = new Set(inserted.map((row) => row.badge));
  const awarded = toAward.filter((b) => mine.has(b.id));
  return { progress, awarded, celebrate: badgesToCelebrate(awarded, had.size > 0, now) };
}

/**
 * The owner's sticker album: awards what is due (quietly, the post-save check celebrates), then every badge in
 * catalogue order, earned or with its progress.
 */
export async function badgeAlbum(
  db: UserClient,
  userId: string,
  rows: Pick<StatsRows, "titles" | "entries">,
  timeZone: string,
  now: number,
): Promise<AlbumBadge[]> {
  const { progress } = await syncBadges(db, userId, rows, timeZone, now);
  const awarded = await userBadges(db, userId);
  const names = new Map(rows.titles.map((t) => [t.id, t.name]));
  return albumBadges(progress, awarded, (id) => names.get(id) ?? null);
}
