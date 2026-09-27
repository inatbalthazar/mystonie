import { cookies } from "next/headers";
import { formatPrefs, isTheme, parseAccountPatch, PREFS_COOKIE } from "@/core/account";
import { deleteAccount } from "@/data/account";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";
import { prefsCookieOptions } from "@/lib/prefs";

const noStore = { "Cache-Control": "no-store" };

/**
 * PATCH /api/account { username?, displayName?, avatarUrl?: null, locale?, timeZone?, theme?, visibility?, emailRecaps? }
 * → the saved settings | 400 invalid | 401 | 409 username_taken | 422 name_not_allowed { field } | 503.
 * Settings are written as the user (RLS + column grants); the database re-checks the username, the name
 * blocklist and the time zone. The preferences cookie is refreshed, so the saved language and theme apply at once.
 */
export async function PATCH(request: Request) {
  const patch = parseAccountPatch(await request.json().catch(() => null), routing.locales);
  if (!patch) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("username, display_name, avatar_url, locale, time_zone, theme, visibility, email_recaps")
    .single();
  if (error) {
    if (error.code === "23505") return Response.json({ error: "username_taken" }, { status: 409, headers: noStore });
    // The blocklist trigger names the column in the hint; other check failures (the time zone) are plain invalid.
    if (error.code === "23514" && (error.hint === "username" || error.hint === "display_name")) {
      return Response.json({ error: "name_not_allowed", field: error.hint }, { status: 422, headers: noStore });
    }
    if (error.code === "23514") return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
    console.error("profile update failed", error.message);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }

  if (isTheme(data.theme)) {
    (await cookies()).set(PREFS_COOKIE, formatPrefs({ locale: data.locale, theme: data.theme }), prefsCookieOptions());
  }
  return Response.json(
    {
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      locale: data.locale,
      timeZone: data.time_zone,
      theme: data.theme,
      visibility: data.visibility,
      emailRecaps: data.email_recaps,
    },
    { headers: noStore },
  );
}

/**
 * DELETE /api/account → { ok: true } | 401 | 503. Deletes the signed-in user and all their data
 * (Settings → Delete account). The session cookie is SameSite=Lax, so other sites can't trigger it.
 */
export async function DELETE() {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  // getUser() checks the session with Supabase Auth, not just the cookie: this is destructive.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    await supabase.auth.signOut({ scope: "global" }); // revoke every device's session, clear the cookie
    (await cookies()).delete(PREFS_COOKIE);
    await deleteAccount(data.user.id, data.user.email);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (e) {
    console.error("account deletion failed", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
