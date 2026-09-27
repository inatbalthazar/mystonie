// Standard Webhooks signatures (https://www.standardwebhooks.com), as Supabase Auth hooks send them:
// `webhook-signature: v1,<base64 HMAC-SHA256 of "<id>.<timestamp>.<body>">`, keyed with the base64 part
// of the `v1,whsec_<base64>` secret. Web Crypto only, so it runs anywhere.

/** Supabase retries for a few minutes at most; older timestamps are replays. */
const TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = { id: string | null; timestamp: string | null; signature: string | null };

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signWebhook(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const keyBytes = fromBase64(secret.replace(/^v1,/, "").replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  return `v1,${toBase64(new Uint8Array(signature))}`;
}

/** True when one of the (space-separated) v1 signatures matches and the timestamp is fresh. */
export async function verifyWebhook(
  secret: string,
  headers: WebhookHeaders,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!secret || !id || !timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;
  let expected: string;
  try {
    expected = await signWebhook(secret, id, timestamp, body);
  } catch {
    return false; // malformed secret
  }
  return signature.split(" ").some((candidate) => equal(candidate, expected));
}
