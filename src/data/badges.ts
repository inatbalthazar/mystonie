// Badges (S3 badges & shelf, ADR 0038; more since ADR 0063). The rules are src/core/badges.ts; awards are written
// with the service role only, after evaluating the user's own rows (finishes, Reel of the Day plays, challenges, quiz
// answers, reviews, Pro), so no client can give itself a sticker. Reads go through RLS: your own badges, or those of a
// public, unblocked profile. The Supporter sticker for a tip comes from the tip webhook (`awardSupporter`).
import {
  albumBadges,
  badgesToAward,
  badgesToCelebrate,
  evaluateBadges,
  isBadgeId,
  type AlbumBadge,
  type BadgeActivity,
  type BadgeId,
  type BadgeNews,
  type BadgeProgress,
  type EarnedBadge,
} from "@/core/badges";
import { uuidv7 } from "@/core/ids";
import { PAID_STATUSES } from "@/core/support";
import { journalBy } from "./journal";
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

const time = (iso: string | null) => (iso ? Date.parse(iso) : NaN);
const times = (isos: (string | null)[]) => isos.map(time).filter((t) => !Number.isNaN(t));

/**
 * What earns the badges beside finishes (ADR 0063), read as the user (RLS: their own rows). Only as many quiz answers
 * and reviews as the biggest target needs.
 */
export async function badgeActivity(db: UserClient, userId: string): Promise<BadgeActivity> {
  const [reel, challenges, quiz, reviews, subs, profile] = await Promise.all([
    db.from("reel_plays").select("day, solved, guesses, finished_at").eq("user_id", userId).not("finished_at", "is", null).limit(5000),
    db.from("challenge_joins").select("month, completed_at").eq("user_id", userId).not("completed_at", "is", null).is("deleted_at", null).limit(1000),
    db
      .from("quiz_answers")
      .select("answered_at")
      .eq("user_id", userId)
      .in("choice", ["yes", "no"])
      .eq("too_fast", false)
      .order("answered_at")
      .limit(100),
    db
      .from("entries")
      .select("finished_at")
      .eq("user_id", userId)
      .eq("status", "finished")
      .is("deleted_at", null)
      .not("review", "is", null)
      .neq("review", "")
      .not("finished_at", "is", null)
      .order("finished_at")
      .limit(10),
    db
      .from("subscriptions")
      .select("created_at")
      .eq("user_id", userId)
      .in("status", [...PAID_STATUSES]),
    db.from("profiles").select("username").eq("id", userId).maybeSingle(),
  ]);
  for (const [name, r] of Object.entries({ reel, challenges, quiz, reviews, subs, profile })) {
    if (r.error) throw new Error(`badge activity (${name}) read failed: ${r.error.message}`);
  }
  return {
    reel: (reel.data ?? []).map((p) => ({
      day: p.day,
      solved: p.solved,
      guesses: Array.isArray(p.guesses) ? p.guesses.length : 0,
      at: time(p.finished_at),
    })),
    challenges: (challenges.data ?? []).map((c) => ({ month: c.month.slice(0, 7), at: time(c.completed_at) })),
    quiz: times((quiz.data ?? []).map((a) => a.answered_at)),
    reviews: times((reviews.data ?? []).map((e) => e.finished_at)),
    articles: profile.data?.username ? await journalBy(profile.data.username) : [],
    support: times((subs.data ?? []).map((sub) => sub.created_at)),
  };
}

/**
 * Evaluates the badges from `rows` (the user's own, from `statsRows`) and their activity, and awards the earned ones
 * not awarded yet.
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
  const [activity, { data: existing, error }] = await Promise.all([
    badgeActivity(db, userId),
    db.from("user_badges").select("badge").eq("user_id", userId).limit(200),
  ]);
  const progress = evaluateBadges(rows.titles, rows.entries, timeZone, activity);
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
 * After a Reel of the Day play or a quiz answer (ADR 0063): awards the activity badges now due and returns those to
 * celebrate. The finish badges wait for the next check after a save (no finishes are read here, and badges are
 * never taken back, so leaving them out changes nothing). Never throws: a sticker is not worth failing the game for.
 */
export async function activityBadgeNews(db: UserClient, userId: string, now: number): Promise<BadgeNews[]> {
  try {
    const { celebrate } = await syncBadges(db, userId, { titles: [], entries: [] }, "UTC", now);
    return celebrate.map((b) => ({ id: b.id, titleName: null }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * The Supporter sticker for a tip (ADR 0063), given to the account signed in with `email`. Returns whether there is
 * such an account, or null without the service role key.
 */
export async function awardSupporter(email: string, at: number): Promise<boolean | null> {
  const admin = adminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("award_supporter", { p_email: email, p_at: new Date(at).toISOString() });
  if (error) throw new Error(`award_supporter failed: ${error.message}`);
  return data;
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
