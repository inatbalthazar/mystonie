import { rateLimited } from "@/app/api/_lib/http";
import { localizedPath } from "@/core/auth";
import { parseCheckoutBody } from "@/core/billing";
import { createCheckout, stripeConfig } from "@/data/stripe";
import { customerIdFor, getProState } from "@/data/subscriptions";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

const LIMIT = { max: 10, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/billing/checkout { plan: "monthly" | "yearly" } → { url } (a Stripe Checkout page) | 400 | 401 | 409
 * already Pro | 503 Pro off. Coming back from Checkout proves nothing: Pro starts when the webhook says so.
 */
export async function POST(request: Request) {
  const config = stripeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const input = parseCheckoutBody(await request.json().catch(() => null));
  if (!input || !config.prices[input.plan]) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "billing", LIMIT);
  if (limited) return limited;

  try {
    if ((await getProState(supabase, userId)).pro) return Response.json({ error: "already_pro" }, { status: 409, headers: noStore });
    const { data: profile } = await supabase.from("profiles").select("locale").eq("id", userId).single();
    const pro = new URL(localizedPath("/pro", profile?.locale ?? routing.defaultLocale, routing.defaultLocale), siteUrl());
    const url = await createCheckout(config, {
      plan: input.plan,
      userId,
      email: typeof auth.claims.email === "string" ? auth.claims.email : undefined,
      customerId: await customerIdFor(supabase, userId),
      successUrl: `${pro}?checkout=success`,
      cancelUrl: pro.toString(),
    });
    return Response.json({ url }, { headers: noStore });
  } catch (error) {
    console.error("checkout", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
