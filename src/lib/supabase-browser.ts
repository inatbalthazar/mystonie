import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/database.types";

let client: SupabaseClient<Database> | null | undefined;

/**
 * Browser client for the sign-in page only (keeps supabase-js out of other pages' bundles). It stores the
 * session in cookies, so server components and the proxy see it. Null without Supabase configured.
 */
export function browserClient(): SupabaseClient<Database> | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && anonKey ? createBrowserClient<Database>(url, anonKey) : null;
  return client;
}
