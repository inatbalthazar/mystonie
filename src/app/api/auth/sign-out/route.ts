import { NextResponse } from "next/server";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath, safeNextPath, splitLocale } from "@/core/auth";
import { deletePushSubscription } from "@/data/push";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

/**
 * POST /api/auth/sign-out (form: next, push_endpoint?): ends the session on this device and goes to the home page.
 * The saved language and theme stop applying (the preferences cookie belongs to the signed-in user), and this
 * device's push subscription is forgotten, so the next person on it doesn't get the user's recaps.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNextPath(typeof form.get("next") === "string" ? (form.get("next") as string) : "/");
  const { locale } = splitLocale(next, routing.locales, routing.defaultLocale);
  const endpoint = form.get("push_endpoint");
  const supabase = await userClient();
  const userId = supabase ? (await supabase.auth.getClaims()).data?.claims.sub : undefined;
  if (userId && typeof endpoint === "string" && endpoint) {
    await deletePushSubscription(userId, endpoint).catch((error: unknown) => console.error(error));
  }
  await supabase?.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(new URL(localizedPath("/", locale, routing.defaultLocale), request.url), 303);
  response.cookies.delete(PREFS_COOKIE);
  return response;
}
