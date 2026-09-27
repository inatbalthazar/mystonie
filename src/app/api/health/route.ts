import { adminClient } from "@/data/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/health → 200 { ok: true } when the app and database answer, else 503.
 * Polled by the uptime monitor and a daily Vercel cron; the database read also keeps the
 * free Supabase project from pausing after a week without traffic.
 */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  const db = adminClient();
  if (!db) return Response.json({ ok: false, db: "unconfigured" }, { status: 503, headers });

  const { error } = await db.from("titles").select("id", { head: true, count: "exact" }).limit(1);
  if (error) {
    console.error("health check: database error", error.message);
    return Response.json({ ok: false, db: "down" }, { status: 503, headers });
  }
  return Response.json({ ok: true, db: "ok" }, { headers });
}
