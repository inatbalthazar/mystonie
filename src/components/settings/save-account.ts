/** PATCH /api/account from Settings. Errors come back as the route's codes, so forms can say what went wrong. */
export type SaveError = "invalid" | "username_taken" | "name_not_allowed" | "unavailable";

export type SaveResult = { ok: true } | { ok: false; error: SaveError; field?: "username" | "display_name" };

export async function saveAccount(patch: Record<string, unknown>): Promise<SaveResult> {
  try {
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
    const error: SaveError =
      body.error === "invalid" || body.error === "username_taken" || body.error === "name_not_allowed" ? body.error : "unavailable";
    return { ok: false, error, field: body.field === "display_name" ? "display_name" : body.field === "username" ? "username" : undefined };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
