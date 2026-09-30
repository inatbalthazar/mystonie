import { catalogError, otherAccount, rateLimited } from "@/app/api/_lib/http";
import { parseReadingLog } from "@/core/collection/reading";
import { logReading } from "@/data/reading";
import { userClient } from "@/data/supabase-server";
import { ensureTitle } from "@/data/titles";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/reading { id, kind: book|manga, externalId, unit: page|chapter|volume, position, readAt? } → { logs, logId, status }.
 * Logs how far the signed-in user has read (a checkpoint, ADR 0029), at `readAt` (default now, ADR 0042). The title is cached from its catalog when needed
 * and joins the collection as "reading" if it isn't there yet.
 */
export async function POST(request: Request) {
  const input = parseReadingLog(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const other = otherAccount(request, userId);
  if (other) return other;

  const limited = await rateLimited(request, "reading", LIMIT);
  if (limited) return limited;

  let title;
  try {
    title = await ensureTitle(input.kind, input.externalId);
  } catch (error) {
    return catalogError(error);
  }
  if (!title) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });

  try {
    const result = await logReading(supabase, userId, title.id, input);
    return Response.json(result, { status: 201, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
