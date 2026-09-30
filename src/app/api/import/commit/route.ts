import { rateLimited } from "@/app/api/_lib/http";
import { parseCommitBody } from "@/core/import/commit";
import { commitImport } from "@/data/import";
import { userClient } from "@/data/supabase-server";

const LIMIT = { max: 120, windowSeconds: 60 };
const noStore = { "Cache-Control": "no-store" };
// A batch of series fetches every season of each (cached after), and a batch of books a search or two each.
export const maxDuration = 60;

/**
 * POST /api/import/commit { rows: ImportRow[], done? } → { results: ImportOutcome[] }. Saves the titles the user
 * confirmed in the preview, with their episodes and reading logs (S2 Letterboxd import, S3 import & export, ADR
 * 0041). A batch is ≤ 25 rows, ≤ 5 of them series with episodes, ≤ 3,000 logs. Idempotent: a title already in the
 * collection is kept or moved forward, never added twice, and logs already there aren't logged again. `done: true`
 * ends the import.
 */
export async function POST(request: Request) {
  const now = Date.now();
  const input = parseCommitBody(await request.json().catch(() => null), now);
  if (!input) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  if (!supabase) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims.sub;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const limited = await rateLimited(request, "import-commit", LIMIT);
  if (limited) return limited;

  try {
    const results = await commitImport(supabase, userId, input.rows, input.done, now);
    return Response.json({ results }, { headers: noStore });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
