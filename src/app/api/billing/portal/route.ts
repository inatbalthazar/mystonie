import { rateLimited } from "@/app/api/_lib/http";
import { localizedPath } from "@/core/auth";
import { createPortal, stripeConfig } from "@/data/stripe";
import { customerIdFor } from "@/data/subscriptions";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

const LIMIT = { max: 10, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/billing/portal → { url } (Stripe's Customer Portal: change plan, card, invoices, cancel) | 401 | 404
 * never subscribed | 503 Pro off. Changes made there come back through the webhook.
 */
export async function POST(request: Request) {
  const config = stripeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "billing", LIMIT);
  if (limited) return limited;

  try {
    const customerId = await customerIdFor(supabase, userId);
    if (!customerId) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    const { data: profile } = await supabase.from("profiles").select("locale").eq("id", userId).single();
    const back = new URL(localizedPath("/pro", profile?.locale ?? routing.defaultLocale, routing.defaultLocale), siteUrl());
    return Response.json({ url: await createPortal(config, customerId, back.toString()) }, { headers: noStore });
  } catch (error) {
    console.error("portal", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
