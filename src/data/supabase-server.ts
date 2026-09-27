import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

export type UserClient = SupabaseClient<Database>;

/** Supabase URL + anon key, or null when auth isn't configured (development without Supabase). */
export function publicSupabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey } : null;
}

/**
 * The signed-in user's client for server components and route handlers (ADR 0020): the session lives in
 * cookies and RLS applies. Server components can't write cookies, so token refreshes they trigger are
 * dropped here; the proxy refreshes the session before rendering.
 */
export async function userClient(): Promise<UserClient | null> {
  const env = publicSupabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a server component: the proxy has already refreshed the session.
        }
      },
    },
  });
}
