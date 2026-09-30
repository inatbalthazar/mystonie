// Stripe over its REST API (S2 Pro, ADR 0034): Checkout, the Customer Portal, cancelling, prices and webhook
// signatures. No SDK: a handful of form-encoded calls and one HMAC. Server only; the secret key never reaches the
// browser. Pro is off unless PRO_ENABLED=true and the keys and prices are set (test-mode keys work the same).
import { createHmac, timingSafeEqual } from "node:crypto";
import { parseStripeSignature, WEBHOOK_TOLERANCE_S, type PlanPrice, type ProPlan } from "@/core/billing";

const API = "https://api.stripe.com/v1";
/** Pinned so responses keep one shape; webhooks follow the endpoint's own version (both shapes are read). */
const STRIPE_VERSION = "2025-08-27.basil";

export type StripeConfig = { secretKey: string; webhookSecret: string; prices: Record<ProPlan, string | null> };

/** Stripe settings, or null when Pro is switched off (then nothing about Pro shows anywhere). */
export function stripeConfig(env: Record<string, string | undefined> = process.env): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const monthly = env.STRIPE_PRICE_MONTHLY?.trim() || null;
  const yearly = env.STRIPE_PRICE_YEARLY?.trim() || null;
  if (env.PRO_ENABLED !== "true" || !secretKey || !webhookSecret || (!monthly && !yearly)) return null;
  return { secretKey, webhookSecret, prices: { monthly, yearly } };
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Nested params the way Stripe reads them: `{ a: { b: 1 } }` → `a[b]=1`, arrays as `a[0]`. */
function form(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [key, value] of Object.entries(params)) {
    const name = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === "object") form(value as Record<string, unknown>, name, out);
    else out.append(name, String(value));
  }
  return out;
}

async function stripe<T>(config: StripeConfig, method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>, revalidate?: number): Promise<T> {
  const body = params && method !== "GET" ? form(params) : undefined;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Stripe-Version": STRIPE_VERSION,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body,
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new StripeError(`Stripe ${method} ${path} responded ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

/**
 * A Checkout session for a Pro subscription → its URL. The user id rides in the subscription's metadata, which is
 * how the webhook knows whose Pro it is. An existing customer is reused, so one person has one Stripe customer.
 */
export async function createCheckout(
  config: StripeConfig,
  input: { plan: ProPlan; userId: string; email: string | undefined; customerId: string | null; successUrl: string; cancelUrl: string },
): Promise<string> {
  const price = config.prices[input.plan];
  if (!price) throw new StripeError(`no price for ${input.plan}`, 400);
  const session = await stripe<{ url: string }>(config, "POST", "/checkout/sessions", {
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    ...(input.customerId ? { customer: input.customerId } : { customer_email: input.email }),
    subscription_data: { metadata: { user_id: input.userId } },
    metadata: { user_id: input.userId },
    allow_promotion_codes: true,
  });
  return session.url;
}

/** A Customer Portal session (change plan, update card, cancel) → its URL. */
export async function createPortal(config: StripeConfig, customerId: string, returnUrl: string): Promise<string> {
  const session = await stripe<{ url: string }>(config, "POST", "/billing_portal/sessions", { customer: customerId, return_url: returnUrl });
  return session.url;
}

/** Ends a subscription now (account deletion: nobody is left to use it, so it must stop charging). */
export async function cancelSubscriptionNow(config: StripeConfig, subscriptionId: string): Promise<void> {
  try {
    await stripe(config, "DELETE", `/subscriptions/${encodeURIComponent(subscriptionId)}`);
  } catch (error) {
    // Already cancelled or gone: nothing left to stop.
    if (!(error instanceof StripeError && error.status === 404)) throw error;
  }
}

/** The plans' prices as Stripe has them (cached an hour), so the page never shows a price Stripe won't charge. */
export async function planPrices(config: StripeConfig): Promise<PlanPrice[]> {
  const plans = (["monthly", "yearly"] as const).filter((p) => config.prices[p]);
  const prices = await Promise.all(
    plans.map(async (plan) => {
      const price = await stripe<{ unit_amount: number | null; currency: string }>(config, "GET", `/prices/${encodeURIComponent(config.prices[plan]!)}`, undefined, 3600);
      return price.unit_amount === null ? null : { plan, amount: price.unit_amount / 100, currency: price.currency.toUpperCase() };
    }),
  );
  return prices.filter((p): p is PlanPrice => p !== null);
}

/**
 * Verifies a webhook's `Stripe-Signature` against the raw body (HMAC-SHA256 of `t.body` with the endpoint
 * secret, constant-time) and its age. Returns the parsed event, or null when it's not from Stripe.
 */
export function verifyWebhook(rawBody: string, header: string | null, secret: string, now: number): unknown | null {
  const parsed = parseStripeSignature(header);
  if (!parsed || Math.abs(now / 1000 - parsed.timestamp) > WEBHOOK_TOLERANCE_S) return null;
  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.${rawBody}`).digest();
  const ok = parsed.signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

/** Signs a payload the way Stripe does (tests and the local webhook fake). */
export function signWebhook(rawBody: string, secret: string, timestamp: number): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
}
