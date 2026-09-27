// Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8188 + RFC 8291), on Web
// Crypto only, so it runs the same in Node, edge runtimes and a future Expo app (ADR 0028). No SDK.

export type PushKeys = { p256dh: string; auth: string };
export type PushSubscriptionInput = { endpoint: string; keys: PushKeys };
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

/** What the service worker shows (public/sw.js). `url` is a same-site path. */
export type PushMessage = { title: string; body: string; url: string; tag?: string };

const ENDPOINT_MAX = 1024;
/** Record size in the aes128gcm header. One record always fits: payloads stay far below it. */
const RECORD_SIZE = 4096;
/** Push services accept at least 4096 bytes of body; header (86) + tag (16) + delimiter leave this much. */
export const PUSH_PAYLOAD_MAX = 3993;

/**
 * Hosts of the browsers' push services. Subscriptions must point at one of them, so a forged subscription can't
 * make the server POST to an arbitrary URL (SSRF). Chrome/Edge-on-Android/Samsung/Opera: FCM; Firefox: Mozilla;
 * Safari (macOS and installed iOS apps): Apple; Edge on Windows: WNS.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "android.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];
const PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".push.apple.com", ".notify.windows.com"];

// ---------------------------------------------------------------------------
// base64url
// ---------------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Null for anything that isn't base64url (or plain base64, which some browsers' `toJSON` used to give). */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_+/-]*={0,2}$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

const utf8 = (text: string) => new TextEncoder().encode(text);

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/** Whether a push endpoint is https on a known push service (or, when `allowLocal`, a local test server). */
export function isPushEndpoint(endpoint: string, allowLocal = false): boolean {
  if (endpoint.length > ENDPOINT_MAX) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (allowLocal && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) return url.protocol === "http:" || url.protocol === "https:";
  if (url.protocol !== "https:" || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * A browser `PushSubscription.toJSON()` from a request body, or null. The keys must be a P-256 public key
 * (65 bytes, uncompressed) and a 16-byte auth secret.
 */
export function parsePushSubscription(body: unknown, allowLocal = false): PushSubscriptionInput | null {
  if (typeof body !== "object" || body === null) return null;
  const { endpoint, keys } = body as { endpoint?: unknown; keys?: unknown };
  if (typeof endpoint !== "string" || !isPushEndpoint(endpoint, allowLocal)) return null;
  if (typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys as { p256dh?: unknown; auth?: unknown };
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return null;
  const publicKey = fromBase64Url(p256dh);
  const secret = fromBase64Url(auth);
  if (!publicKey || publicKey.length !== 65 || publicKey[0] !== 4 || !secret || secret.length !== 16) return null;
  return { endpoint, keys: { p256dh: toBase64Url(publicKey), auth: toBase64Url(secret) } };
}

// ---------------------------------------------------------------------------
// VAPID (RFC 8292)
// ---------------------------------------------------------------------------

/** A VAPID key pair as the env holds it: the raw public key (65 bytes) and the private scalar `d` (32 bytes). */
function vapidJwk(publicKey: string, privateKey: string): JsonWebKey | null {
  const pub = fromBase64Url(publicKey);
  const d = fromBase64Url(privateKey);
  if (!pub || pub.length !== 65 || pub[0] !== 4 || !d || d.length !== 32) return null;
  return { kty: "EC", crv: "P-256", x: toBase64Url(pub.slice(1, 33)), y: toBase64Url(pub.slice(33)), d: toBase64Url(d), ext: true };
}

/** Whether the env's VAPID keys are well formed (checked before any send). */
export function isVapidKeyPair(publicKey: string, privateKey: string): boolean {
  return vapidJwk(publicKey, privateKey) !== null;
}

/**
 * The `Authorization` header for one push service: `vapid t=<ES256 JWT>, k=<public key>`. The JWT's audience is
 * the endpoint's origin; it expires after 12 hours (the RFC allows up to 24).
 */
export async function vapidAuthorization(endpoint: string, vapid: VapidKeys, now = Date.now()): Promise<string> {
  const jwk = vapidJwk(vapid.publicKey, vapid.privateKey);
  if (!jwk) throw new Error("invalid VAPID keys");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = toBase64Url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = toBase64Url(
    utf8(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: vapid.subject })),
  );
  // Web Crypto's ECDSA signature is r ‖ s (64 bytes), which is exactly the JWS ES256 format.
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${toBase64Url(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}

// ---------------------------------------------------------------------------
// Payload encryption (RFC 8291 over RFC 8188 aes128gcm)
// ---------------------------------------------------------------------------

async function hkdf(salt: Uint8Array<ArrayBuffer>, ikm: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** Test hook: a fixed salt and sender key pair reproduce the RFC 8291 example. */
export type EncryptOptions = { salt?: Uint8Array<ArrayBuffer>; senderKeys?: { publicKey: string; privateKey: string } };

/** The encrypted request body (`Content-Encoding: aes128gcm`) for one subscription. */
export async function encryptPushPayload(payload: Uint8Array, keys: PushKeys, options: EncryptOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  if (payload.length > PUSH_PAYLOAD_MAX) throw new Error(`push payload of ${payload.length} bytes is too large`);
  const uaPublic = fromBase64Url(keys.p256dh);
  const authSecret = fromBase64Url(keys.auth);
  if (!uaPublic || uaPublic.length !== 65 || !authSecret || authSecret.length !== 16) throw new Error("invalid subscription keys");

  // A fresh ECDH key pair per message (the RFC's "application server" keys; not the VAPID keys).
  let senderPrivate: CryptoKey;
  let senderPublic: Uint8Array<ArrayBuffer>;
  if (options.senderKeys) {
    const jwk = vapidJwk(options.senderKeys.publicKey, options.senderKeys.privateKey);
    if (!jwk) throw new Error("invalid sender keys");
    senderPrivate = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    senderPublic = fromBase64Url(options.senderKeys.publicKey)!;
  } else {
    const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
    senderPrivate = pair.privateKey;
    senderPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const receiver = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiver }, senderPrivate, 256));

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, ecdhSecret, concat(utf8("WebPush: info\0"), uaPublic, senderPublic), 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record, so it's the last: the payload, then the 0x02 delimiter, no padding.
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));

  const header = new Uint8Array(16 + 4 + 1 + senderPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = senderPublic.length;
  header.set(senderPublic, 21);
  return concat(header, ciphertext);
}

/** Everything `fetch` needs to deliver one message to one subscription. */
export async function pushRequest(
  subscription: PushSubscriptionInput,
  message: PushMessage,
  vapid: VapidKeys,
  { ttlSeconds = 2 * 86_400, topic }: { ttlSeconds?: number; topic?: string } = {},
): Promise<{ url: string; headers: Record<string, string>; body: Uint8Array<ArrayBuffer> }> {
  const body = await encryptPushPayload(utf8(JSON.stringify(message)), subscription.keys);
  return {
    url: subscription.endpoint,
    headers: {
      Authorization: await vapidAuthorization(subscription.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttlSeconds),
      Urgency: "normal",
      // A newer message with the same topic replaces one still waiting on the push service (≤ 32 URL-safe chars).
      ...(topic ? { Topic: topic } : {}),
    },
    body,
  };
}

/** What a push service's answer means for the stored subscription (RFC 8030 §5, §8.3). */
export function pushOutcome(status: number): "sent" | "gone" | "failed" {
  if (status >= 200 && status < 300) return "sent";
  // 404/410: the subscription expired or was removed. Anything else (403 bad VAPID JWT, 413, 429, 5xx) is ours
  // or the service's problem, so the subscription stays.
  if (status === 404 || status === 410) return "gone";
  return "failed";
}

/**
 * The browser's side of `encryptPushPayload`: the plaintext of a single-record aes128gcm body, given the
 * subscription's private key (`d`, base64url) and keys. Browsers do this themselves; tests and the e2e fake push
 * service use it.
 */
export async function decryptPushPayload(body: Uint8Array, keys: PushKeys, privateKey: string): Promise<Uint8Array> {
  const jwk = vapidJwk(keys.p256dh, privateKey);
  const authSecret = fromBase64Url(keys.auth);
  if (!jwk || !authSecret) throw new Error("invalid keys");
  const salt = body.slice(0, 16);
  const idLength = body[20]!;
  const senderPublic = body.slice(21, 21 + idLength);
  const receiverPrivate = await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  const sender = await crypto.subtle.importKey("raw", senderPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: sender }, receiverPrivate, 256));
  const ikm = await hkdf(authSecret, ecdhSecret, concat(utf8("WebPush: info\0"), fromBase64Url(keys.p256dh)!, senderPublic), 32);
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, body.slice(21 + idLength)));
  const end = padded.lastIndexOf(2);
  if (end < 0) throw new Error("no record delimiter");
  return padded.slice(0, end);
}
