import { getProState } from "@/data/subscriptions";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/billing/status → ProState `{ available, pro, renewsAt, cancelAtPeriodEnd }`. Signed out, or with Pro
 * switched off, it's simply not Pro. The card editor asks it which templates are unlocked, and the Pro page polls
 * it after Checkout until the webhook has landed.
 */
export async function GET() {
  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  try {
    return Response.json(await getProState(supabase, auth?.claims.sub), { headers: noStore });
  } catch (error) {
    console.error("billing status", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
