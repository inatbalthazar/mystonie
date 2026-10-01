import { bearerAuthorized } from "@/app/api/_lib/http";
import { normalEmail } from "@/core/support";
import { awardSupporter } from "@/data/badges";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/admin/supporter { email }, `Authorization: Bearer $ADMIN_SECRET` (ADR 0063). Gives the Supporter sticker
 * to the account signed in with `email`, for someone who tipped from another email address and wrote in.
 * → { matched } (false: no account with that email). 401 | 400 | 503.
 */
export async function POST(request: Request) {
  if (!bearerAuthorized(request, process.env.ADMIN_SECRET)) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = normalEmail(body?.email);
  if (!email) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  try {
    const matched = await awardSupporter(email, Date.now());
    if (matched === null) return Response.json({ error: "database_unavailable" }, { status: 503, headers: noStore });
    return Response.json({ matched }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 500, headers: noStore });
  }
}
