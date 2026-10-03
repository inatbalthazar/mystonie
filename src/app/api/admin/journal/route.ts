import { parseReview } from "@/core/journal-posts";
import { teamMember } from "@/data/admin";
import { reviewPost } from "@/data/journal-posts";
import { adminClient } from "@/data/supabase-admin";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/admin/journal { id, action: "approve" | "decline" | "hide" | "unhide", note? } → { ok: true } | 400 |
 * 403 (not the team: signed in with an `ADMIN_EMAILS` address) | 404 | 503. The team's answer to a member's Journal
 * article (stage 4, ADR 0092), from /admin/journal.
 */
export async function POST(request: Request) {
  if (!(await teamMember())) return Response.json({ error: "forbidden" }, { status: 403, headers: noStore });
  const review = parseReview(await request.json().catch(() => null));
  if (!review) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const admin = adminClient();
  if (!admin) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  try {
    const done = await reviewPost(admin, review.id, review.action, review.note);
    return done ? Response.json({ ok: true }, { headers: noStore }) : Response.json({ error: "not_found" }, { status: 404, headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
