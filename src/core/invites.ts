// Invites (ADR 0098): `/join/<username>` remembers who invited you on this device; once you've made an account, it's
// accepted once and you and the inviter follow each other. The inviter earns the Plus One sticker.
import { USERNAME_RE } from "./account";

/** localStorage key of the invite waiting for an account. */
export const INVITE_KEY = "mystonie.invite";

/** How long a remembered invite waits for an account. */
export const INVITE_DAYS = 7;

/** The invite link's path (localized by the app's Link, or prefixed with the site URL to share). */
export const invitePath = (username: string) => `/join/${username}`;

const username = (value: unknown): string | null =>
  typeof value === "string" && USERNAME_RE.test(value.trim().toLowerCase()) ? value.trim().toLowerCase() : null;

/** What `/join/<username>` stores. */
export const storeInvite = (name: string, now: number): string => JSON.stringify({ username: name, at: now });

/** The inviter's username from storage, or null when there's none, it's broken or older than `INVITE_DAYS`. */
export function storedInvite(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { username?: unknown; at?: unknown };
    if (typeof value.at !== "number" || now - value.at > INVITE_DAYS * 86_400_000 || value.at > now + 60_000) return null;
    return username(value.username);
  } catch {
    return null;
  }
}

/** POST /api/invites `{ username }`. */
export function parseInvite(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  return username((body as Record<string, unknown>).username);
}
