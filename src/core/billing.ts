// Mystonie Pro (S2 Pro, ADR 0034): who is Pro, and reading Stripe's webhook events. Pure rules; the Stripe calls,
// the signature check and the database live in src/data. Pro comes only from verified webhook events (ADR 0003).

export const PRO_PLANS = ["monthly", "yearly"] as const;
export type ProPlan = (typeof PRO_PLANS)[number];
export const isProPlan = (v: unknown): v is ProPlan => (PRO_PLANS as readonly unknown[]).includes(v);

export const SUBSCRIPTION_STATUSES = ["incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Stripe keeps retrying a failed renewal for a while (past_due): Pro stays on meanwhile. */
const PRO_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing", "past_due"];

/** A missed webhook must not leave Pro on forever: past the period end plus this, it's off whatever the status. */
export const PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export type Subscription = {
  subscriptionId: string;
  customerId: string;
  userId: string;
  status: SubscriptionStatus;
  priceId: string | null;
  /** ISO time. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** ISO time of the Stripe event it was read from. */
  eventAt: string;
};

/** Whether this subscription makes its user Pro at `now`. */
export function grantsPro(sub: Pick<Subscription, "status" | "currentPeriodEnd">, now: number): boolean {
  if (!PRO_STATUSES.includes(sub.status)) return false;
  const end = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : NaN;
  return Number.isNaN(end) || end + PERIOD_GRACE_MS > now;
}

/** A plan's price as Stripe charges it (`amount` in the currency's main unit, e.g. 2.99). */
export type PlanPrice = { plan: ProPlan; amount: number; currency: string };

/** What the Pro page and the card editor need to know. */
export type ProState = {
  /** Pro can be bought here at all (PRO_ENABLED and Stripe keys set). */
  available: boolean;
  pro: boolean;
  /** The subscription that grants it: when it renews or, once cancelled, ends. */
  renewsAt: string | null;
  cancelAtPeriodEnd: boolean;
};

/** The user's Pro state from their subscriptions (the one granting Pro, latest period first). */
export function proState(available: boolean, subs: readonly Pick<Subscription, "status" | "currentPeriodEnd" | "cancelAtPeriodEnd">[], now: number): ProState {
  const granting = subs
    .filter((s) => grantsPro(s, now))
    .sort((a, b) => (b.currentPeriodEnd ?? "").localeCompare(a.currentPeriodEnd ?? ""))[0];
  return {
    available,
    pro: available && !!granting,
    renewsAt: granting?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: granting?.cancelAtPeriodEnd ?? false,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------------------------------------------

/** How old a signed webhook may be (Stripe's own libraries use 5 minutes): an old capture can't be replayed later. */
export const WEBHOOK_TOLERANCE_S = 300;

/** `Stripe-Signature: t=1700000000,v1=abc…,v1=def…` → its time and v1 signatures, or null. */
export function parseStripeSignature(header: string | null): { timestamp: number; signatures: string[] } | null {
  if (!header || header.length > 2000) return null;
  let timestamp = NaN;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "t" && value && /^\d{1,12}$/.test(value.trim())) timestamp = Number(value.trim());
    if (key?.trim() === "v1" && value && /^[0-9a-f]{64}$/.test(value.trim())) signatures.push(value.trim());
  }
  return Number.isFinite(timestamp) && signatures.length > 0 ? { timestamp, signatures } : null;
}

/** The subscription events we act on; everything else is acknowledged and ignored. */
export const SUBSCRIPTION_EVENTS = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"] as const;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, re: RegExp): string | null => (typeof v === "string" && re.test(v) ? v : null);
const iso = (seconds: unknown): string | null =>
  typeof seconds === "number" && Number.isInteger(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * A verified Stripe event → the subscription it describes, or null when it isn't a subscription event we can use
 * (another type, or no Mystonie user in its metadata: the Checkout session puts `user_id` there). Handles both the
 * older payload (`current_period_end` on the subscription) and the 2025 one (on each item).
 */
export function subscriptionFromEvent(event: unknown): Subscription | null {
  if (!isObject(event) || !(SUBSCRIPTION_EVENTS as readonly unknown[]).includes(event.type)) return null;
  const eventAt = iso(event.created);
  const sub = isObject(event.data) ? event.data.object : null;
  if (!eventAt || !isObject(sub)) return null;
  const subscriptionId = str(sub.id, /^sub_[A-Za-z0-9]{1,250}$/);
  const customerId = str(isObject(sub.customer) ? sub.customer.id : sub.customer, /^cus_[A-Za-z0-9]{1,250}$/);
  const userId = str(isObject(sub.metadata) ? sub.metadata.user_id : null, UUID_RE);
  const status = (SUBSCRIPTION_STATUSES as readonly unknown[]).includes(sub.status) ? (sub.status as SubscriptionStatus) : null;
  if (!subscriptionId || !customerId || !userId || !status) return null;

  const items = isObject(sub.items) && Array.isArray(sub.items.data) ? sub.items.data.filter(isObject) : [];
  const item = items[0];
  const price = item && isObject(item.price) ? item.price : null;
  const periodEnd = iso(sub.current_period_end) ?? (item ? iso(item.current_period_end) : null);
  return {
    subscriptionId,
    customerId,
    userId,
    // A deleted subscription is over, whatever its last status said.
    status: event.type === "customer.subscription.deleted" ? "canceled" : status,
    priceId: price ? str(price.id, /^price_[A-Za-z0-9]{1,250}$/) : null,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    eventAt,
  };
}

/** Whether an event may overwrite the stored row: only an event at least as new (replays write the same values). */
export function isNewer(eventAt: string, storedEventAt: string | null | undefined): boolean {
  return !storedEventAt || Date.parse(eventAt) >= Date.parse(storedEventAt);
}

/** POST /api/billing/checkout `{ plan }` → the plan, or null. */
export function parseCheckoutBody(body: unknown): { plan: ProPlan } | null {
  return isObject(body) && isProPlan(body.plan) ? { plan: body.plan } : null;
}
