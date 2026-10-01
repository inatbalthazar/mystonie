import { rateLimited } from "@/app/api/_lib/http";
import { gettingStartedFacts } from "@/data/getting-started";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/getting-started → { facts } | 401 | 429 | 503. The counts behind the floating getting-started button
 * (stage 4, ADR 0056): it asks on each page while the checklist is open, so a step done anywhere ticks.
 */
export async function GET(request: Request) {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "getting-started", LIMIT);
  if (limited) return limited;

  try {
    return Response.json({ facts: await gettingStartedFacts(supabase, userId) }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
