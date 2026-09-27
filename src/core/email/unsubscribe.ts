// Signed unsubscribe links: stateless, so an email needs no stored token.
// The token is an HMAC of the list and the row id (a waitlist row, or a profile for recaps), so a link can't be
// forged, pointed at someone else, or reused for another list.
// Web Crypto (globalThis.crypto) runs the same in Node, edge runtimes and a future Expo app.

/** Mailing lists with their own unsubscribe: the waitlist (launch email) and account recap emails. */
export const EMAIL_LISTS = ["waitlist", "recaps"] as const;
export type EmailList = (typeof EMAIL_LISTS)[number];

export function isEmailList(value: unknown): value is EmailList {
  return (EMAIL_LISTS as readonly unknown[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 16 bytes of the SHA-256 HMAC is plenty against guessing and keeps the URL short. */
const TOKEN_BYTES = 16;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Token for the unsubscribe link of one row (a waitlist row id, or a profile id for `recaps`). */
export async function unsubscribeToken(secret: string, id: string, list: EmailList = "waitlist"): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`unsubscribe:${list}:${id.toLowerCase()}`));
  return base64url(new Uint8Array(signature).slice(0, TOKEN_BYTES));
}

/** Constant-time check of a token from a link. */
export async function verifyUnsubscribeToken(secret: string, id: string, token: string, list: EmailList = "waitlist"): Promise<boolean> {
  if (!isUuid(id)) return false;
  const expected = await unsubscribeToken(secret, id, list);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/**
 * `page`: the link in the email body (a confirm page, so link scanners that open URLs don't unsubscribe anyone).
 * `oneClick`: the `List-Unsubscribe` target for mail apps, which POST to it (RFC 8058).
 * Waitlist links carry no `list` parameter, as the ones already sent don't.
 */
export function unsubscribeLinks(site: URL, locale: string, defaultLocale: string, id: string, token: string, list: EmailList = "waitlist") {
  const query = new URLSearchParams({ id, t: token, ...(list === "waitlist" ? {} : { list }) }).toString();
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return {
    page: new URL(`${prefix}/unsubscribe?${query}`, site).toString(),
    oneClick: new URL(`/api/unsubscribe?${query}`, site).toString(),
  };
}
