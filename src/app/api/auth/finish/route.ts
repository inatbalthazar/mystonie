import { NextResponse } from "next/server";
import { PREFS_COOKIE } from "@/core/account";
import { safeNextPath, splitLocale } from "@/core/auth";
import { afterSocialSignIn } from "@/data/sign-in";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

/**
 * POST /api/auth/finish { next, tz } → { ok } | 401 | 503. After Google's own button signed the browser in with an ID
 * token (ADR 0073), there is no callback: this does the callback's part (`afterSocialSignIn`) for the session the
 * browser now holds.
 */
export async function POST(request: Request) {
  const supabase = await userClient();
  if (!supabase)
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    next?: unknown;
    tz?: unknown;
  } | null;
  const next = safeNextPath(typeof body?.next === "string" ? body.next : null);
  const { locale } = splitLocale(next, routing.locales, routing.defaultLocale);
  await afterSocialSignIn(supabase, data.user, {
    locale,
    tz: typeof body?.tz === "string" ? body.tz : "",
  });
  const response = NextResponse.json({ ok: true });
  // Drop a previous account's saved language and theme; the proxy loads this account's on the next request.
  response.cookies.delete(PREFS_COOKIE);
  return response;
}
