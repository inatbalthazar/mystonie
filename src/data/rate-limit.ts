import { createHash } from "node:crypto";
import { adminClient } from "./supabase-admin";

export type Limit = { max: number; windowSeconds: number };

/** Caller's IP as reported by Vercel's proxy (first `x-forwarded-for` hop). */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** `bucket:<salted sha-256>`. Raw IPs are never stored. */
export function rateLimitKey(bucket: string, ip: string, salt: string): string {
  const hash = createHash("sha256").update(`${salt}:${ip}`).digest("base64url");
  return `${bucket}:${hash}`;
}

/**
 * Counts one request against the caller's fixed window and says whether it's allowed.
 * Fails open (allows) when Supabase is missing or errors: search staying up matters more.
 */
export async function allowRequest(headers: Headers, bucket: string, limit: Limit): Promise<boolean> {
  const db = adminClient();
  if (!db) return true;
  const { data, error } = await db.rpc("rate_limit_hit", {
    p_key: rateLimitKey(bucket, clientIp(headers), process.env.IP_HASH_SALT ?? ""),
    p_window_seconds: limit.windowSeconds,
    p_max: limit.max,
  });
  if (error) {
    console.error("rate_limit_hit failed", error.message);
    return true;
  }
  return data;
}
