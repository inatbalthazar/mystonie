import { isUuidV7 } from "@/core/ids";
import { unlogReading } from "@/data/reading";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/** PATCH /api/reading/[id] { deleted: true } → { ok: true }. Un-logs a reading checkpoint (soft delete, owner only). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/reading/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { deleted?: unknown } | null;
  if (!isUuidV7(id) || body?.deleted !== true) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    if (!(await unlogReading(supabase, id))) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
