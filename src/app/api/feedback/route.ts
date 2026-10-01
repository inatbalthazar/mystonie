import { hasLocale } from "next-intl";
import { rateLimited } from "@/app/api/_lib/http";
import { feedbackDevice, parseFeedback } from "@/core/feedback";
import { fileFeedback } from "@/data/feedback";
import { userClient } from "@/data/supabase-server";
import { routing } from "@/i18n/routing";

// People report now and then; this stops scripted floods of the operator's inbox.
const LIMIT = { max: 10, windowSeconds: 3600 };
const MAX_BODY_BYTES = 12_000;
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/feedback { kind: "bug" | "idea" | "other", message, page?, errorRef?, locale?, website? } → { ok: true } |
 * 400 | 429 | 503. "Report a problem" during the beta (ADR 0055). Signed-out visitors may report too; a signed-in
 * reporter is recorded (id and email, so the operator can reply) and sees the report under "Your reports".
 */
export async function POST(request: Request) {
  const limited = await rateLimited(request, "feedback", LIMIT);
  if (limited) return limited;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = parseFeedback(body);
  // Honeypot: same answer as a real report, so bots learn nothing.
  if (parsed.kind === "bot") return Response.json({ ok: true }, { headers: noStore });
  if (parsed.kind === "invalid") return Response.json({ error: "invalid" }, { status: 400, headers: noStore });

  const supabase = await userClient();
  const { data: auth } = supabase ? await supabase.auth.getClaims() : { data: null };
  const claimed = (body as { locale?: unknown }).locale;
  try {
    await fileFeedback(parsed.feedback, {
      userId: auth?.claims.sub ?? null,
      email: typeof auth?.claims.email === "string" ? auth.claims.email : null,
      device: feedbackDevice(request.headers.get("user-agent")),
      locale: typeof claimed === "string" && hasLocale(routing.locales, claimed) ? claimed : routing.defaultLocale,
    });
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("feedback failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
