import { describe, expect, it } from "vitest";
import { signWebhook, stripeConfig, verifyWebhook } from "./stripe";

const SECRET = "whsec_test_secret";
const NOW = 1_790_000_000_000;
const body = JSON.stringify({ id: "evt_1", type: "customer.subscription.created" });

describe("verifyWebhook", () => {
  it("accepts Stripe's signature and returns the event", () => {
    expect(verifyWebhook(body, signWebhook(body, SECRET, NOW / 1000), SECRET, NOW)).toEqual({ id: "evt_1", type: "customer.subscription.created" });
  });

  it("rejects another secret, a changed body and an old signature", () => {
    const header = signWebhook(body, SECRET, NOW / 1000);
    expect(verifyWebhook(body, header, "whsec_other", NOW)).toBeNull();
    expect(verifyWebhook(body.replace("created", "deleted"), header, SECRET, NOW)).toBeNull();
    expect(verifyWebhook(body, header, SECRET, NOW + 301_000)).toBeNull();
    expect(verifyWebhook(body, null, SECRET, NOW)).toBeNull();
  });
});

describe("stripeConfig", () => {
  const keys = { STRIPE_SECRET_KEY: "sk_test_1", STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_MONTHLY: "price_m" };
  it("is off unless PRO_ENABLED is true and the keys and a price are set", () => {
    expect(stripeConfig({ ...keys })).toBeNull();
    expect(stripeConfig({ ...keys, PRO_ENABLED: "1" })).toBeNull();
    expect(stripeConfig({ PRO_ENABLED: "true", STRIPE_SECRET_KEY: "sk_test_1", STRIPE_WEBHOOK_SECRET: SECRET })).toBeNull();
    expect(stripeConfig({ ...keys, PRO_ENABLED: "true" })).toEqual({
      secretKey: "sk_test_1",
      webhookSecret: SECRET,
      prices: { monthly: "price_m", yearly: null },
    });
  });
});
