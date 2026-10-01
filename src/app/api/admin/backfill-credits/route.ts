import { bearerAuthorized } from "@/app/api/_lib/http";
import { backfillCredits } from "@/data/titles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const BATCH_MAX = 50;

/**
 * POST /api/admin/backfill-credits { limit?: 1–50 }, `Authorization: Bearer $ADMIN_SECRET` (stage 4, ADR 0047).
 * Fills `titles.credits` for the next `limit` titles cached before credits existed. Run it again until `remaining`
 * is 0 (`failed` ones are retried by the next run). → { fromCache, fetched, failed, remaining }
 */
export async function POST(request: Request) {
  if (!bearerAuthorized(request, process.env.ADMIN_SECRET)) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown };
  const limit = Math.min(BATCH_MAX, Math.max(1, Math.floor(Number(body.limit) || 25)));
  try {
    const result = await backfillCredits(limit);
    if (!result) return Response.json({ error: "database_unavailable" }, { status: 503, headers: noStore });
    return Response.json(result, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "backfill_failed" }, { status: 500, headers: noStore });
  }
}
