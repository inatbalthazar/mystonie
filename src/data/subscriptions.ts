// Pro subscriptions in Postgres (S2 Pro, ADR 0034). The webhook writes with the service role; everything else
// reads as the user (RLS: their own rows).
import { isNewer, proState, type ProState, type Subscription, type SubscriptionStatus } from "@/core/billing";
import { stripeConfig } from "./stripe";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

/**
 * Stores what a verified Stripe event says about a subscription, unless a newer event already did (events arrive
 * out of order and are retried). Returns whether the row changed. Throws on a database error, so Stripe retries.
 */
export async function saveSubscription(sub: Subscription): Promise<boolean> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  const { data: stored, error: readError } = await db
    .from("subscriptions")
    .select("event_at")
    .eq("stripe_subscription_id", sub.subscriptionId)
    .maybeSingle();
  if (readError) throw new Error(`subscriptions read failed: ${readError.message}`);
  if (!isNewer(sub.eventAt, stored?.event_at)) return false;
  const { error } = await db.from("subscriptions").upsert(
    {
      stripe_subscription_id: sub.subscriptionId,
      user_id: sub.userId,
      stripe_customer_id: sub.customerId,
      status: sub.status,
      price_id: sub.priceId,
      current_period_end: sub.currentPeriodEnd,
      cancel_at_period_end: sub.cancelAtPeriodEnd,
      event_at: sub.eventAt,
    },
    { onConflict: "stripe_subscription_id" },
  );
  // A user deleted meanwhile (foreign key): nothing to keep Pro for.
  if (error?.code === "23503") return false;
  if (error) throw new Error(`subscriptions write failed: ${error.message}`);
  return true;
}

type Row = { stripe_customer_id: string; stripe_subscription_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean };

async function rows(db: UserClient, userId: string): Promise<Row[]> {
  const { data, error } = await db
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`subscriptions read failed: ${error.message}`);
  return data;
}

/** Whether the user is Pro (and whether Pro can be bought at all). */
export async function getProState(db: UserClient | null, userId: string | null | undefined, now = Date.now()): Promise<ProState> {
  const available = stripeConfig() !== null;
  if (!available || !db || !userId) return proState(available, [], now);
  const subs = await rows(db, userId);
  return proState(
    available,
    subs.map((s) => ({ status: s.status as SubscriptionStatus, currentPeriodEnd: s.current_period_end, cancelAtPeriodEnd: s.cancel_at_period_end })),
    now,
  );
}

/** The user's Stripe customer (the latest one), for Checkout and the portal. */
export async function customerIdFor(db: UserClient, userId: string): Promise<string | null> {
  return (await rows(db, userId))[0]?.stripe_customer_id ?? null;
}

/** Subscriptions that could still charge the user (account deletion cancels them). Service role. */
export async function liveSubscriptionIds(userId: string): Promise<string[]> {
  const db = adminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .not("status", "in", "(canceled,incomplete_expired)");
  if (error) throw new Error(`subscriptions read failed: ${error.message}`);
  return data.map((r) => r.stripe_subscription_id);
}
