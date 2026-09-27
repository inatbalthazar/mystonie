import { describe, expect, it } from "vitest";
import {
  decryptPushPayload,
  encryptPushPayload,
  fromBase64Url,
  isPushEndpoint,
  isVapidKeyPair,
  parsePushSubscription,
  pushOutcome,
  pushRequest,
  toBase64Url,
  vapidAuthorization,
} from "./push";

// RFC 8291 Appendix A.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPublic: "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  uaPrivate: "q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body:
    "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};
const UA_KEYS = { p256dh: RFC.uaPublic, auth: RFC.auth };

describe("encryptPushPayload", () => {
  it("reproduces the RFC 8291 example", async () => {
    const body = await encryptPushPayload(new TextEncoder().encode(RFC.plaintext), UA_KEYS, {
      salt: fromBase64Url(RFC.salt)!,
      senderKeys: { publicKey: RFC.asPublic, privateKey: RFC.asPrivate },
    });
    expect(toBase64Url(body)).toBe(RFC.body);
  });

  it("uses a fresh salt and key per message, and the browser can read it", async () => {
    const payload = new TextEncoder().encode(JSON.stringify({ title: "Your week", body: "3 finished", url: "/recap/x" }));
    const [a, b] = await Promise.all([encryptPushPayload(payload, UA_KEYS), encryptPushPayload(payload, UA_KEYS)]);
    expect(toBase64Url(a)).not.toBe(toBase64Url(b));
    expect(new TextDecoder().decode(await decryptPushPayload(a, UA_KEYS, RFC.uaPrivate))).toBe(new TextDecoder().decode(payload));
    expect(new TextDecoder().decode(await decryptPushPayload(fromBase64Url(RFC.body)!, UA_KEYS, RFC.uaPrivate))).toBe(RFC.plaintext);
  });

  it("refuses payloads over the limit and bad keys", async () => {
    await expect(encryptPushPayload(new Uint8Array(4000), UA_KEYS)).rejects.toThrow("too large");
    await expect(encryptPushPayload(new Uint8Array(1), { p256dh: "AAAA", auth: RFC.auth })).rejects.toThrow("invalid");
  });
});

describe("vapidAuthorization", () => {
  it("signs an ES256 JWT for the endpoint's origin that verifies with the public key", async () => {
    const vapid = { publicKey: RFC.asPublic, privateKey: RFC.asPrivate, subject: "mailto:ops@example.com" };
    const now = Date.UTC(2026, 8, 28, 9);
    const header = await vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", vapid, now);
    const [, jwt, key] = header.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(key).toBe(RFC.asPublic);
    const [h, c, s] = jwt!.split(".");
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(h!)!))).toEqual({ typ: "JWT", alg: "ES256" });
    expect(JSON.parse(new TextDecoder().decode(fromBase64Url(c!)!))).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: now / 1000 + 12 * 3600,
      sub: "mailto:ops@example.com",
    });
    const publicKey = await crypto.subtle.importKey("raw", fromBase64Url(RFC.asPublic)!, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      fromBase64Url(s!)!,
      new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });

  it("checks the key pair shape", () => {
    expect(isVapidKeyPair(RFC.asPublic, RFC.asPrivate)).toBe(true);
    expect(isVapidKeyPair(RFC.asPublic, "short")).toBe(false);
    expect(isVapidKeyPair("", RFC.asPrivate)).toBe(false);
  });
});

describe("pushRequest", () => {
  it("builds the headers push services expect", async () => {
    const vapid = { publicKey: RFC.asPublic, privateKey: RFC.asPrivate, subject: "mailto:ops@example.com" };
    const req = await pushRequest(
      { endpoint: "https://web.push.apple.com/QGuQ", keys: UA_KEYS },
      { title: "Your week", body: "1 finished", url: "/recap/1" },
      vapid,
      { topic: "weekly-recap" },
    );
    expect(req.url).toBe("https://web.push.apple.com/QGuQ");
    expect(req.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: "172800", Urgency: "normal", Topic: "weekly-recap" });
    expect(req.headers.Authorization).toMatch(/^vapid t=.+\..+\..+, k=/);
    const message = JSON.parse(new TextDecoder().decode(await decryptPushPayload(req.body, UA_KEYS, RFC.uaPrivate)));
    expect(message).toEqual({ title: "Your week", body: "1 finished", url: "/recap/1" });
  });
});

describe("subscriptions", () => {
  const sub = (endpoint: string, keys: unknown = UA_KEYS) => parsePushSubscription({ endpoint, keys, expirationTime: null });

  it("accepts the browsers' push services only", () => {
    for (const ok of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://db5p.notify.windows.com/w/?token=BQYAAA",
    ]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.com/x",
      "https://evil.com/fcm.googleapis.com",
      "https://169.254.169.254/latest/meta-data",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "http://localhost:4000/push",
      "not a url",
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
    expect(isPushEndpoint("http://localhost:4000/push", true)).toBe(true);
    expect(isPushEndpoint("http://127.0.0.1:4000/push", true)).toBe(true);
  });

  it("parses PushSubscription.toJSON()", () => {
    expect(sub("https://fcm.googleapis.com/fcm/send/abc")).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: UA_KEYS });
    // Standard base64 with padding is normalized.
    const padded = { p256dh: btoa(String.fromCharCode(...fromBase64Url(RFC.uaPublic)!)), auth: btoa(String.fromCharCode(...fromBase64Url(RFC.auth)!)) };
    expect(sub("https://fcm.googleapis.com/x", padded)?.keys).toEqual(UA_KEYS);
    expect(sub("https://evil.com/x")).toBeNull();
    expect(sub("https://fcm.googleapis.com/x", { p256dh: RFC.uaPublic })).toBeNull();
    expect(sub("https://fcm.googleapis.com/x", { p256dh: RFC.auth, auth: RFC.auth })).toBeNull();
    expect(sub("https://fcm.googleapis.com/x", { p256dh: RFC.uaPublic, auth: RFC.uaPublic })).toBeNull();
    expect(sub("https://fcm.googleapis.com/x", { p256dh: "***", auth: RFC.auth })).toBeNull();
    expect(parsePushSubscription(null)).toBeNull();
    expect(parsePushSubscription({ endpoint: "https://fcm.googleapis.com/" + "a".repeat(1100), keys: UA_KEYS })).toBeNull();
  });

  it("maps push service answers", () => {
    expect(pushOutcome(201)).toBe("sent");
    expect(pushOutcome(410)).toBe("gone");
    expect(pushOutcome(404)).toBe("gone");
    expect(pushOutcome(403)).toBe("failed");
    expect(pushOutcome(429)).toBe("failed");
    expect(pushOutcome(500)).toBe("failed");
  });
});
