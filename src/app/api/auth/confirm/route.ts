import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { PREFS_COOKIE } from "@/core/account";
import { localizedPath, safeNextPath, splitLocale } from "@/core/auth";
import { isSignInAction } from "@/core/email/sign-in";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

/**
 * POST /api/auth/confirm (form: token_hash, type, next) from the confirm page the email link opens.
 * Signs in with the one-time token and redirects to `next`; on failure back to the sign-in page.
 * A POST, not the link itself, so mail scanners that open links can't use up the token.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const field = (name: string) => (typeof form.get(name) === "string" ? (form.get(name) as string) : "");
  const next = safeNextPath(field("next"));
  const { locale } = splitLocale(next, routing.locales, routing.defaultLocale);
  const type = field("type");
  const tokenHash = field("token_hash");

  const supabase = await userClient();
  if (supabase && tokenHash && isSignInAction(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
    if (!error) return signedIn(new URL(next, request.url));
    console.warn("email link sign-in failed", error.code ?? error.message);
  }
  const retry = `${localizedPath("/auth", locale, routing.defaultLocale)}?${new URLSearchParams({ error: "link", next })}`;
  return NextResponse.redirect(new URL(retry, request.url), 303);
}

/** After a sign-in: drops the previous account's preferences cookie, so the proxy loads this account's. */
function signedIn(next: URL): NextResponse {
  const response = NextResponse.redirect(next, 303);
  response.cookies.delete(PREFS_COOKIE);
  return response;
}
