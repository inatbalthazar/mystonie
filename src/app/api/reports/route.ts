import { rateLimited } from "@/app/api/_lib/http";
import { parseReport } from "@/core/reports";
import { fileReport } from "@/data/reports";
import { userClient } from "@/data/supabase-server";

// A person reports now and then; this stops scripted floods of the operator's inbox.
const LIMIT = { max: 10, windowSeconds: 3600 };
const MAX_BODY_BYTES = 4_000;
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/reports { targetKind: "profile" | "card", targetId, reason, note?, website? } → { ok: true } | 400 |
 * 404 (not a public profile or shared card) | 429 | 503. Signed-out visitors may report too; a signed-in
 * reporter is recorded (their id only).
 */
export async function POST(request: Request) {
  const limited = await rateLimited(request, "report", LIMIT);
  if (limited) return limited;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = parseReport(body);
  // Honeypot: same answer as a real report, so bots learn nothing.
  if (parsed.kind === "bot") return Response.json({ ok: true }, { headers: noStore });
  if (parsed.kind === "invalid") return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  try {
    const filed = await fileReport(parsed.report, auth?.claims.sub ?? null);
    if (!filed) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("report failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
