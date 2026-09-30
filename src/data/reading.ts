// Reading progress rows (S2 books & manga, ADR 0029), read and written as the user (RLS: their own rows).
import type { EntryStatus } from "@/core/collection/entries";
import type { ReadingLogRequest, ReadingUnit } from "@/core/collection/reading";
import type { StatsReadingLog } from "@/core/stats/reading";
import { startWatching } from "./entries";
import type { UserClient } from "./supabase-server";

export type LoggedReading = { id: string; unit: ReadingUnit; position: number; readAt: string };

const fromRow = (r: { id: string; title_id: string; unit: string; position: number; read_at: string }): StatsReadingLog => ({
  id: r.id,
  titleId: r.title_id,
  unit: r.unit as ReadingUnit,
  position: r.position,
  readAt: r.read_at,
});

/** Every live reading log of the user (collection rows, stats). */
export async function readLogs(db: UserClient, userId: string): Promise<StatsReadingLog[]> {
  const { data, error } = await db
    .from("reading_logs")
    .select("id, title_id, unit, position, read_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .limit(20000);
  if (error) throw new Error(`reading_logs read failed: ${error.message}`);
  return data.map(fromRow);
}

/** The user's live reading logs of one title, oldest first. */
export async function titleReadingLogs(db: UserClient, userId: string, titleId: string): Promise<LoggedReading[]> {
  const { data, error } = await db
    .from("reading_logs")
    .select("id, unit, position, read_at")
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .is("deleted_at", null)
    .order("read_at")
    .order("id")
    .limit(5000);
  if (error) throw new Error(`reading_logs read failed: ${error.message}`);
  return data.map((r) => ({ id: r.id, unit: r.unit as ReadingUnit, position: r.position, readAt: r.read_at }));
}

/**
 * Logs reaching `position` in `unit` at the request's time (a point already logged is not logged twice: its log is
 * returned). Reading puts the title in the collection as "reading" (the `watching` status, `startWatching`). Returns
 * every live log of the title, the new log's id and the entry's status.
 */
export async function logReading(
  db: UserClient,
  userId: string,
  titleId: string,
  request: ReadingLogRequest,
): Promise<{ logs: LoggedReading[]; logId: string; status: EntryStatus }> {
  const { error } = await db
    .from("reading_logs")
    .insert({ id: request.id, title_id: titleId, unit: request.unit, position: request.position, read_at: request.readAt });
  // 23505: this point is already logged (or a parallel request logged it); the re-read below has it.
  if (error && error.code !== "23505") throw new Error(`reading_logs insert failed: ${error.message}`);

  const status = await startWatching(db, userId, titleId, request.readAt);
  const logs = await titleReadingLogs(db, userId, titleId);
  const log = logs.find((l) => l.unit === request.unit && l.position === request.position);
  if (!log) throw new Error("reading_logs insert failed: not found after insert");
  return { logs, logId: log.id, status };
}

/** Un-logs a reading checkpoint (soft delete). False when it isn't the user's or is already gone. */
export async function unlogReading(db: UserClient, id: string): Promise<boolean> {
  const { data, error } = await db
    .from("reading_logs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`reading_logs update failed: ${error.message}`);
  return !!data;
}
