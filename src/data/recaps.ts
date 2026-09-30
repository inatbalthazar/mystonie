// Weekly recaps (ADR 0025) and monthly recaps (ADR 0031), both in `weekly_recaps` (`period`). Server only:
// creating and notifying run with the service role from the cron route; reading a recap runs as the user (RLS:
// owners read their own).
import { parseRecap } from "@/core/cards/saved";
import type { CardRecap } from "@/core/cards/types";
import { uuidv7 } from "@/core/ids";
import type { RecapPeriod } from "@/core/stats/recap";
import { ActivityReadError, periodRecaps } from "./activity";
import { adminClient, type AdminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

export class RecapsUnavailableError extends Error {}

function admin(): AdminClient {
  const db = adminClient();
  if (!db) throw new RecapsUnavailableError("Supabase is not configured");
  return db;
}

/** A list result's rows (throws on an error). */
function check<T>(result: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
  if (result.error) throw new RecapsUnavailableError(`${what} failed: ${result.error.message}`);
  return result.data ?? [];
}

/** A `maybeSingle` result's row or null (throws on an error). */
function maybe<T>(result: { data: T | null; error: { message: string } | null }, what: string): T | null {
  if (result.error) throw new RecapsUnavailableError(`${what} failed: ${result.error.message}`);
  return result.data;
}

/** One user's week or month, computed from their rows (the same reader the board uses). */
async function computeRecap(db: AdminClient, userId: string, timeZone: string, period: RecapPeriod, start: string): Promise<CardRecap | null> {
  try {
    return (await periodRecaps(db, [userId], period, start, timeZone)).get(userId) ?? null;
  } catch (error) {
    throw error instanceof ActivityReadError ? new RecapsUnavailableError(error.message) : error;
  }
}

type Due = { userId: string; timeZone: string; period: RecapPeriod; start: string };

/**
 * Creates the recaps due at `now`: weeks (local Monday from 09:00) and months (the local 1st from 09:00), at most
 * `limit` users of each per call (the hourly job picks up the rest). Idempotent: a user, period and start that
 * already have a recap are skipped. Returns how many were created.
 */
export async function createDueRecaps(now: Date, limit: number): Promise<number> {
  const db = admin();
  const [weeks, months] = await Promise.all([
    db.rpc("weekly_recap_candidates", { p_now: now.toISOString(), p_limit: limit }).then((r) => check(r, "recap candidates")),
    db.rpc("monthly_recap_candidates", { p_now: now.toISOString(), p_limit: limit }).then((r) => check(r, "monthly recap candidates")),
  ]);
  const due: Due[] = [
    ...weeks.map((w) => ({ userId: w.user_id, timeZone: w.time_zone, period: "week" as const, start: w.week_start })),
    ...months.map((m) => ({ userId: m.user_id, timeZone: m.time_zone, period: "month" as const, start: m.month_start })),
  ];
  let created = 0;
  // A few users at a time: enough to finish well inside the route's time limit without flooding Postgres.
  for (let i = 0; i < due.length; i += 5) {
    const batch = due.slice(i, i + 5);
    const rows = await Promise.all(
      batch.map(async (u) => {
        const stats = await computeRecap(db, u.userId, u.timeZone, u.period, u.start);
        return stats && { id: uuidv7(), user_id: u.userId, period: u.period, week_start: u.start, stats };
      }),
    );
    const fresh = rows.filter((r) => r !== null);
    if (fresh.length === 0) continue;
    const inserted = check(
      await db.from("weekly_recaps").upsert(fresh, { onConflict: "user_id,period,week_start", ignoreDuplicates: true }).select("id"),
      "weekly_recaps write",
    );
    created += inserted.length;
  }
  return created;
}

export type RecapToNotify = { id: string; userId: string; email: string; locale: string; weekStart: string; recap: CardRecap };

/** Recaps whose email hasn't gone out yet, for people with recap emails on (oldest first). */
export async function recapsToNotify(limit: number): Promise<RecapToNotify[]> {
  const rows = check(await admin().rpc("weekly_recaps_to_notify", { p_limit: limit }), "recaps to notify");
  return rows.flatMap((r) => {
    const recap = parseRecap(r.stats);
    return recap ? [{ id: r.id, userId: r.user_id, email: r.email, locale: r.locale, weekStart: r.week_start, recap }] : [];
  });
}

export async function markRecapsNotified(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  maybe(await admin().from("weekly_recaps").update({ notified_at: new Date().toISOString() }).in("id", ids), "weekly_recaps update");
}

/** Turns recap emails off (the email's unsubscribe link; idempotent). */
export async function unsubscribeFromRecaps(userId: string): Promise<void> {
  maybe(await admin().from("profiles").update({ email_recaps: false }).eq("id", userId), "profiles update");
}

/** Remembers which card was made from a recap (the table is server-written). Best effort. */
export async function linkRecapCard(userId: string, recapId: string, cardId: string): Promise<void> {
  const db = adminClient();
  if (!db) return;
  const { error } = await db.from("weekly_recaps").update({ card_id: cardId }).eq("id", recapId).eq("user_id", userId);
  if (error) console.error("recap card link failed", error.message);
}

export type UserRecap = { id: string; weekStart: string; createdAt: string; recap: CardRecap };

const toUserRecap = (row: { id: string; week_start: string; created_at: string; stats: unknown }): UserRecap | null => {
  const recap = parseRecap(row.stats);
  return recap && { id: row.id, weekStart: row.week_start, createdAt: row.created_at, recap };
};

/** One of the signed-in user's recaps (RLS), or null. */
export async function userRecap(db: UserClient, id: string): Promise<UserRecap | null> {
  const row = maybe(await db.from("weekly_recaps").select("id, week_start, created_at, stats").eq("id", id).maybeSingle(), "weekly_recaps read");
  return row && toUserRecap(row);
}

/** The user's newest recap (week or month) if it was made in the last `days` days (Home's "your week" note). */
export async function latestRecap(db: UserClient, userId: string, days = 7): Promise<UserRecap | null> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const row = maybe(
    await db
      .from("weekly_recaps")
      .select("id, week_start, created_at, stats")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "weekly_recaps read",
  );
  return row && toUserRecap(row);
}
