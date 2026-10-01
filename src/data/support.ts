// Buy Me a Coffee tips (ADR 0063): their webhook is signed with HMAC-SHA256 of the raw body under the secret from
// the Buy Me a Coffee dashboard (`BMC_WEBHOOK_SECRET`), sent hex-encoded in `x-signature-sha256`.
import { createHmac, timingSafeEqual } from "node:crypto";

/** The webhook secret, or null when tips aren't wired up (a missing or short secret never verifies anything). */
export function tipWebhookSecret(): string | null {
  const secret = process.env.BMC_WEBHOOK_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

/** The parsed body when `signature` is the body's HMAC under `secret` (constant-time), else null. */
export function verifyTip(rawBody: string, signature: string | null, secret: string): unknown {
  if (!signature || !/^[0-9a-f]{64}$/i.test(signature.trim())) return null;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature.trim(), "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

/** The `x-signature-sha256` header for `rawBody` (tests sign their own events with it). */
export function signTip(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
