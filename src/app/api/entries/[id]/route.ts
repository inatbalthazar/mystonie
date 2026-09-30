import { otherAccount } from "@/app/api/_lib/http";
import { parseEntryPatch } from "@/core/collection/entries";
import { isUuidV7 } from "@/core/ids";
import { updateEntry } from "@/data/entries";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * PATCH /api/entries/[id] { status, finishedAt? } | { rating, review } | { deleted: true }, each with `editedAt?` →
 * { entry } | { ok: true }. Edits the finish date or status, the rating and review, or removes the entry (soft delete).
 * RLS limits it to the owner. A change older than the entry's last edit (it waited offline, ADR 0042) isn't applied:
 * { entry, superseded: true } is what stays.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/entries/[id]">) {
  const { id } = await ctx.params;
  const patch = parseEntryPatch(await request.json().catch(() => null));
  if (!isUuidV7(id) || !patch) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const other = otherAccount(request, userId);
  if (other) return other;

  try {
    const saved = await updateEntry(supabase, id, patch);
    if (!saved) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    if (saved.superseded) return Response.json({ entry: saved.item, superseded: true }, { headers: noStore });
    return Response.json(patch.deleted ? { ok: true } : { entry: saved.item }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
