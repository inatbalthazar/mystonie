import { parseEntryPatch } from "@/core/collection/entries";
import { isUuidV7 } from "@/core/ids";
import { updateEntry } from "@/data/entries";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * PATCH /api/entries/[id] { status, finishedAt? } | { rating, review } | { deleted: true } → { entry } | { ok: true }.
 * Edits the finish date or status, the rating and review, or removes the entry (soft delete). RLS limits it
 * to the owner.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/entries/[id]">) {
  const { id } = await ctx.params;
  const patch = parseEntryPatch(await request.json().catch(() => null));
  if (!isUuidV7(id) || !patch) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    const entry = await updateEntry(supabase, id, patch);
    if (!entry) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json(patch.deleted ? { ok: true } : { entry }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
