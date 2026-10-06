// Visits (ADR 0098): counted with the service role from POST /api/views, read by their owner through RLS. Server only.
import { createHash } from "node:crypto";
import { viewKey, VIEW_SUBJECTS, visitorSeed, type ViewCount, type ViewCounts, type ViewSubject } from "@/core/views";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

/**
 * Counts one visit, once a day per visitor; false when it didn't count (or there's no service role). The visitor is a
 * salted hash of the day plus the viewer's id, or their IP address and browser: never stored as is.
 */
export async function recordView(
  subject: ViewSubject,
  id: string,
  visitor: { viewerId: string | null; ip: string; userAgent: string },
  now = Date.now(),
): Promise<boolean> {
  const admin = adminClient();
  if (!admin) return false;
  const day = new Date(now).toISOString().slice(0, 10);
  const hash = createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? ""}|views|${visitorSeed(day, visitor.viewerId, visitor.ip, visitor.userAgent)}`)
    .digest("base64url");
  const { data, error } = await admin.rpc("record_view", { p_subject: subject, p_subject_id: id, p_visitor: hash, p_viewer: visitor.viewerId ?? undefined });
  if (error) throw new Error(`record_view failed: ${error.message}`);
  return data;
}

/** The viewer's own visits per page, card and article. Never fails a page: on an error there are none. */
export async function myViews(db: UserClient, days?: number): Promise<ViewCounts> {
  const { data, error } = await db.rpc("my_views", days ? { p_days: days } : {});
  if (error) {
    console.error(`my_views failed: ${error.message}`);
    return new Map();
  }
  return new Map(
    data.flatMap((r): [string, ViewCount][] =>
      (VIEW_SUBJECTS as readonly string[]).includes(r.subject) ? [[viewKey(r.subject as ViewSubject, r.subject_id), { recent: r.recent, total: r.total }]] : [],
    ),
  );
}
