import { teamMember } from "@/data/admin";
import { forgetOfficialAccounts } from "@/data/official";
import { adminClient } from "@/data/supabase-admin";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/admin/team-label { on: boolean } → { ok: true } | 400 | 403 (not the team) | 503. Puts the Team label on
 * the signed-in team member's own account, or takes it off (ADR 0098). With it, new members follow them to start.
 */
export async function POST(request: Request) {
  const team = await teamMember();
  if (!team) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const body = (await request.json().catch(() => null)) as { on?: unknown } | null;
  if (typeof body?.on !== "boolean") return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { error } = await admin
    .from("profiles")
    .update({ official: body.on ? "team" : null })
    .eq("id", team.userId)
    // Never touches Stonie's label.
    .or("official.is.null,official.eq.team");
  if (error) {
    console.error(`team label update failed: ${error.message}`);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
  forgetOfficialAccounts();
  return Response.json({ ok: true }, { headers: noStore });
}
