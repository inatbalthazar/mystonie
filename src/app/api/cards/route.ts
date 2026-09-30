import { rateLimited } from "@/app/api/_lib/http";
import { parseCardSave } from "@/core/cards/saved";
import { isProTemplate } from "@/core/cards/templates";
import { saveCard } from "@/data/cards";
import { getProState } from "@/data/subscriptions";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 30, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/cards { id, kind, templateId, size, entryId?, episodeLogId?, data, share? } → { id, uploadUrl }.
 * Saves a card's inputs as the signed-in user (RLS; the same id again updates it). With `share`, the card is
 * published at /c/[id] and `uploadUrl` is a signed Storage URL to PUT the PNG to (null when Storage is off).
 * A Pro template needs an active Pro subscription (403 `pro_required`, ADR 0034).
 */
export async function POST(request: Request) {
  const input = parseCardSave(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "cards", LIMIT);
  if (limited) return limited;

  try {
    if (isProTemplate(input.templateId) && !(await getProState(supabase, userId)).pro) {
      return Response.json({ error: "pro_required" }, { status: 403, headers: noStore });
    }
    const saved = await saveCard(supabase, userId, input);
    if (!saved) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ id: input.id, uploadUrl: saved.uploadUrl }, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
