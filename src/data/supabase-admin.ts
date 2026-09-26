import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AdminClient = SupabaseClient<Database>;

let client: AdminClient | null | undefined;

/**
 * Service-role client for route handlers only (bypasses RLS; the key never reaches the browser).
 * Returns null when Supabase isn't configured, so callers can degrade instead of crashing.
 */
export function adminClient(): AdminClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  client = url && key ? createClient<Database>(url, key, { auth: { persistSession: false } }) : null;
  if (!client) console.warn("Supabase is not configured: rate limits and the title cache are off.");
  return client;
}
