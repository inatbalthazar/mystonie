import { rateLimited } from "@/app/api/_lib/http";
import { checkProgress } from "@/data/milestones";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 60, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/milestones → { milestones: CardData[], badges: BadgeNews[], challenges: CardData[] }. After a finish or a
 * log, the client asks whether it crossed a milestone (the 100th title, 1,000 hours, …; ADR 0031), earned a badge (a
 * sticker, ADR 0038) or completed a monthly challenge it joined (ADR 0040). Each comes back once: milestones and
 * challenges as the inputs of their card, badges as slugs for the sticker toast.
 */
export async function POST(request: Request) {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "milestones", LIMIT);
  if (limited) return limited;

  try {
    return Response.json(await checkProgress(supabase, userId, Date.now()), { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
