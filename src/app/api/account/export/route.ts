import { exportAccount } from "@/data/profiles";
import { userClient } from "@/data/supabase-server";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET /api/account/export → a JSON download of everything the signed-in user has stored (Settings → Export my
 * data): account, profile, entries, episode logs, cards and weekly recaps, deleted rows included. 401 | 503.
 */
export async function GET() {
  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  try {
    const document = await exportAccount(supabase, { id: data.user.id, email: data.user.email, createdAt: data.user.created_at });
    const day = document.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(document, null, 2), {
      headers: {
        ...noStore,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mystonie-${document.profile.username}-${day}.json"`,
      },
    });
  } catch (e) {
    console.error("account export failed", e);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
