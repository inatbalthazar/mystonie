import { subscriptionFromEvent } from "@/core/billing";
import { stripeConfig, verifyWebhook } from "@/data/stripe";
import { saveSubscription } from "@/data/subscriptions";

const MAX_BODY_BYTES = 256_000;
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/billing/webhook (Stripe → us; S2 Pro, ADR 0034). The only way Pro is granted or taken away: a
 * `customer.subscription.*` event, verified against `STRIPE_WEBHOOK_SECRET`, is stored in `subscriptions` unless a
 * newer event already was (replays and out-of-order deliveries change nothing). Other events get 200 and are
 * ignored. 400 for anything not signed by Stripe; 500 when saving fails, so Stripe retries.
 */
export async function POST(request: Request) {
  const config = stripeConfig();
  if (!config) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const event = verifyWebhook(raw, request.headers.get("stripe-signature"), config.webhookSecret, Date.now());
  if (!event) return Response.json({ error: "invalid_signature" }, { status: 400, headers: noStore });

  const sub = subscriptionFromEvent(event);
  if (!sub) return Response.json({ received: true, ignored: true }, { headers: noStore });
  try {
    const changed = await saveSubscription(sub);
    return Response.json({ received: true, changed }, { headers: noStore });
  } catch (error) {
    console.error("stripe webhook", error);
    return Response.json({ error: "unavailable" }, { status: 500, headers: noStore });
  }
}
