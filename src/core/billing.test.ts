import { describe, expect, it } from "vitest";
import { grantsPro, isNewer, parseCheckoutBody, parseStripeSignature, PERIOD_GRACE_MS, proState, subscriptionFromEvent } from "./billing";

const NOW = Date.parse("2026-09-30T12:00:00Z");
const USER = "0199a0e2-7c1d-7000-8000-00000000abcd";

/** A Stripe `customer.subscription.*` event, 2025 shape (period end on the item) unless overridden. */
function event(type: string, sub: Record<string, unknown> = {}, created = 1_790_000_000) {
  return {
    id: "evt_1",
    type,
    created,
    data: {
      object: {
        id: "sub_123",
        object: "subscription",
        customer: "cus_456",
        status: "active",
        cancel_at_period_end: false,
        metadata: { user_id: USER },
        items: { data: [{ price: { id: "price_monthly" }, current_period_end: 1_792_592_000 }] },
        ...sub,
      },
    },
  };
}

describe("grantsPro", () => {
  const end = new Date(NOW + 86_400_000).toISOString();
  it("is on while active, trialing or past due", () => {
    for (const status of ["active", "trialing", "past_due"] as const) expect(grantsPro({ status, currentPeriodEnd: end }, NOW)).toBe(true);
  });

  it("is off once cancelled, unpaid, expired or paused", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
      expect(grantsPro({ status, currentPeriodEnd: end }, NOW)).toBe(false);
    }
  });

  it("ends a few days after the period even if a webhook was missed", () => {
    const past = new Date(NOW - PERIOD_GRACE_MS - 1000).toISOString();
    expect(grantsPro({ status: "active", currentPeriodEnd: past }, NOW)).toBe(false);
    expect(grantsPro({ status: "active", currentPeriodEnd: new Date(NOW - 1000).toISOString() }, NOW)).toBe(true);
  });
});

describe("proState", () => {
  it("is never Pro while Pro is unavailable", () => {
    expect(proState(false, [{ status: "active", currentPeriodEnd: null, cancelAtPeriodEnd: false }], NOW).pro).toBe(false);
  });

  it("reports the granting subscription's renewal, and a cancellation", () => {
    const later = new Date(NOW + 20 * 86_400_000).toISOString();
    expect(
      proState(
        true,
        [
          { status: "canceled", currentPeriodEnd: new Date(NOW + 40 * 86_400_000).toISOString(), cancelAtPeriodEnd: false },
          { status: "active", currentPeriodEnd: later, cancelAtPeriodEnd: true },
        ],
        NOW,
      ),
    ).toEqual({ available: true, pro: true, renewsAt: later, cancelAtPeriodEnd: true });
    expect(proState(true, [], NOW)).toEqual({ available: true, pro: false, renewsAt: null, cancelAtPeriodEnd: false });
  });
});

describe("parseStripeSignature", () => {
  const v1 = "a".repeat(64);
  it("reads the time and every v1 signature", () => {
    expect(parseStripeSignature(`t=1790000000,v1=${v1},v0=zzz,v1=${"b".repeat(64)}`)).toEqual({ timestamp: 1_790_000_000, signatures: [v1, "b".repeat(64)] });
  });

  it("is null without a time or a v1", () => {
    expect(parseStripeSignature(null)).toBeNull();
    expect(parseStripeSignature(`v1=${v1}`)).toBeNull();
    expect(parseStripeSignature("t=1790000000,v1=short")).toBeNull();
  });
});

describe("subscriptionFromEvent", () => {
  it("reads a 2025-shape subscription event", () => {
    expect(subscriptionFromEvent(event("customer.subscription.created"))).toEqual({
      subscriptionId: "sub_123",
      customerId: "cus_456",
      userId: USER,
      status: "active",
      priceId: "price_monthly",
      currentPeriodEnd: new Date(1_792_592_000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      eventAt: new Date(1_790_000_000 * 1000).toISOString(),
    });
  });

  it("reads the older shape (period end on the subscription) and an expanded customer", () => {
    const sub = subscriptionFromEvent(
      event("customer.subscription.updated", { current_period_end: 1_800_000_000, customer: { id: "cus_789" }, cancel_at_period_end: true }),
    );
    expect(sub).toMatchObject({ customerId: "cus_789", currentPeriodEnd: new Date(1_800_000_000 * 1000).toISOString(), cancelAtPeriodEnd: true });
  });

  it("marks a deleted subscription cancelled", () => {
    expect(subscriptionFromEvent(event("customer.subscription.deleted", { status: "active" }))?.status).toBe("canceled");
  });

  it("ignores other events and subscriptions that aren't ours", () => {
    expect(subscriptionFromEvent(event("invoice.paid"))).toBeNull();
    expect(subscriptionFromEvent(event("customer.subscription.created", { metadata: {} }))).toBeNull();
    expect(subscriptionFromEvent(event("customer.subscription.created", { metadata: { user_id: "not-a-uuid" } }))).toBeNull();
    expect(subscriptionFromEvent(event("customer.subscription.created", { status: "lifetime" }))).toBeNull();
    expect(subscriptionFromEvent(event("customer.subscription.created", { id: "nope" }))).toBeNull();
    expect(subscriptionFromEvent(null)).toBeNull();
  });
});

describe("isNewer", () => {
  it("lets the same or a newer event through, never an older one", () => {
    expect(isNewer("2026-09-30T12:00:00.000Z", null)).toBe(true);
    expect(isNewer("2026-09-30T12:00:00.000Z", "2026-09-30T12:00:00+00:00")).toBe(true);
    expect(isNewer("2026-09-30T11:59:59.000Z", "2026-09-30T12:00:00+00:00")).toBe(false);
  });
});

describe("parseCheckoutBody", () => {
  it("takes a known plan only", () => {
    expect(parseCheckoutBody({ plan: "yearly" })).toEqual({ plan: "yearly" });
    expect(parseCheckoutBody({ plan: "lifetime" })).toBeNull();
    expect(parseCheckoutBody(null)).toBeNull();
  });
});
