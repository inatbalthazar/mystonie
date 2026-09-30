// Monthly challenges (S3 challenges & clubs, ADR 0040). The lineup and rules are src/core/challenges.ts. Joining and
// leaving are the user's own rows (RLS); progress and completion are written with the service role only, after
// evaluating the user's own rows, so no client can complete a challenge it didn't. Friends' joins are read through
// RLS (public, unblocked profiles); totals come from `challenge_counts()`.
import {
  challengeCardData,
  currentMonth,
  evaluateChallenges,
  findChallenge,
  isChallengeSlug,
  monthDate,
  type ChallengeProgress,
  type ChallengeSlug,
} from "@/core/challenges";
import type { CardData } from "@/core/cards/types";
import { uuidv7 } from "@/core/ids";
import { localDateKey } from "@/core/stats/period";
import { insertLive, type FollowedPerson, type SocialWrite } from "./social";
import type { StatsRows } from "./stats";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

export type ChallengeJoin = { id: string; month: string; slug: ChallengeSlug; progress: number; completedAt: string | null; titleId: string | null };

const COLUMNS = "id, user_id, month, slug, progress, completed_at, title_id";

type JoinRow = { id: string; user_id: string; month: string; slug: string; progress: number; completed_at: string | null; title_id: string | null };

function toJoin(row: JoinRow): ChallengeJoin | null {
  const month = row.month.slice(0, 7);
  if (!isChallengeSlug(row.slug) || !findChallenge(month, row.slug)) return null;
  return { id: row.id, month, slug: row.slug, progress: row.progress, completedAt: row.completed_at, titleId: row.title_id };
}

/** A person's live joins (all months, or one), newest month first. Someone else's only when their profile is public. */
export async function userJoins(db: UserClient, userId: string, month?: string): Promise<ChallengeJoin[]> {
  let query = db.from("challenge_joins").select(COLUMNS).eq("user_id", userId).is("deleted_at", null);
  if (month) query = query.eq("month", monthDate(month));
  const { data, error } = await query.order("month", { ascending: false }).limit(500);
  if (error) throw new Error(`challenge_joins read failed: ${error.message}`);
  return data.flatMap((row) => toJoin(row) ?? []);
}

/** A person's completed challenges ("patches"), newest first. */
export async function userPatches(db: UserClient, userId: string): Promise<ChallengeJoin[]> {
  const joins = await userJoins(db, userId);
  return joins.filter((j) => j.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!));
}

/** How many joined and completed each of the month's challenges. */
export async function challengeCounts(db: UserClient, month: string): Promise<Map<string, { joined: number; completed: number }>> {
  const { data, error } = await db.rpc("challenge_counts", { p_month: monthDate(month) });
  if (error) throw new Error(`challenge_counts failed: ${error.message}`);
  return new Map(data.map((r) => [r.slug, { joined: r.joined, completed: r.completed }]));
}

export type FriendJoin = { person: FollowedPerson; slug: ChallengeSlug; progress: number; completed: boolean };

/** The people the viewer follows who joined the month's challenges, with how far along they are. */
export async function friendJoins(db: UserClient, following: readonly FollowedPerson[], month: string): Promise<FriendJoin[]> {
  if (following.length === 0) return [];
  const byId = new Map(following.map((p) => [p.id, p]));
  const { data, error } = await db
    .from("challenge_joins")
    .select(COLUMNS)
    .in("user_id", [...byId.keys()].slice(0, 200))
    .eq("month", monthDate(month))
    .is("deleted_at", null)
    .limit(1000);
  if (error) throw new Error(`challenge_joins read failed: ${error.message}`);
  return data.flatMap((row) => {
    const join = toJoin(row);
    const person = byId.get(row.user_id);
    return join && person ? [{ person, slug: join.slug, progress: join.progress, completed: !!join.completedAt }] : [];
  });
}

export type ChallengeSync = {
  month: string;
  progress: ChallengeProgress[];
  /** Days of the month with something logged (the card's calendar). */
  days: number[];
  joins: ChallengeJoin[];
  /** Completed by this call (a concurrent call can't complete one twice), as Challenge card inputs. */
  completed: CardData[];
};

/**
 * Evaluates this month's challenges from `rows` (the user's own, from `statsRows`) and records progress and
 * completion on the ones they joined. Without the service role key nothing is recorded.
 */
export async function syncChallenges(db: UserClient, userId: string, rows: StatsRows, timeZone: string, now: number): Promise<ChallengeSync> {
  const month = currentMonth(now, timeZone);
  const [{ progress, days }, joins] = await Promise.all([Promise.resolve(evaluateChallenges(month, timeZone, rows)), userJoins(db, userId, month)]);
  const bySlug = new Map(progress.map((p) => [p.slug, p]));
  const due = joins.filter((j) => !j.completedAt && bySlug.has(j.slug) && (bySlug.get(j.slug)!.done || bySlug.get(j.slug)!.value !== j.progress));
  const admin = due.length > 0 ? adminClient() : null;
  if (!admin) return { month, progress, days, joins, completed: [] };

  const completed: CardData[] = [];
  const titleById = new Map(rows.titles.map((t) => [t.id, t]));
  const stamp = new Date(now).toISOString();
  await Promise.all(
    due.map(async (join) => {
      const p = bySlug.get(join.slug)!;
      if (!p.done) {
        const { error } = await admin.from("challenge_joins").update({ progress: p.value }).eq("id", join.id).is("completed_at", null);
        if (error) throw new Error(`challenge_joins update failed: ${error.message}`);
        join.progress = p.value;
        return;
      }
      // Only the call whose update lands announces it.
      const { data, error } = await admin
        .from("challenge_joins")
        .update({ progress: p.target, completed_at: stamp, title_id: p.titleId })
        .eq("id", join.id)
        .is("completed_at", null)
        .is("deleted_at", null)
        .select("id");
      if (error) throw new Error(`challenge_joins update failed: ${error.message}`);
      Object.assign(join, { progress: p.target, completedAt: stamp, titleId: p.titleId });
      if (data.length === 0) return;
      const title = p.titleId ? titleById.get(p.titleId) : undefined;
      const doneOn = localDateKey(p.doneAt ?? now, timeZone);
      completed.push(challengeCardData(p, month, days, title ? { kind: title.kind, name: title.name, posterUrl: title.posterUrl } : null, doneOn));
    }),
  );
  return { month, progress, days, joins, completed };
}

/** The Challenge card of a completed join (the /challenges page's "Make the card"), from the user's own rows. */
export function joinCardData(join: ChallengeJoin, rows: StatsRows, timeZone: string, days: readonly number[]): CardData | null {
  const challenge = findChallenge(join.month, join.slug);
  if (!challenge || !join.completedAt) return null;
  const title = join.titleId ? rows.titles.find((t) => t.id === join.titleId) : undefined;
  return challengeCardData(
    { slug: join.slug, target: challenge.rule.target },
    join.month,
    days,
    title ? { kind: title.kind, name: title.name, posterUrl: title.posterUrl } : null,
    localDateKey(Date.parse(join.completedAt), timeZone),
  );
}

/** Joins a challenge (a new live row) or leaves it (soft delete; a completed one can't be left). */
export async function setChallenge(db: UserClient, userId: string, month: string, slug: ChallengeSlug, join: boolean): Promise<SocialWrite> {
  if (join) return insertLive(db.from("challenge_joins").insert({ id: uuidv7(), month: monthDate(month), slug }), "challenge_joins");
  const { error } = await db
    .from("challenge_joins")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("month", monthDate(month))
    .eq("slug", slug)
    .is("completed_at", null)
    .is("deleted_at", null);
  if (error) throw new Error(`challenge_joins update failed: ${error.message}`);
  return "ok";
}
