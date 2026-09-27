import { rateLimited } from "@/app/api/_lib/http";
import { parseWaitlistBody } from "@/core/waitlist";
import { joinWaitlist } from "@/data/waitlist";
import { routing } from "@/i18n/routing";

// A person signs up once or twice; this only slows down scripted sign-ups.
const LIMIT = { max: 5, windowSeconds: 600 };
const MAX_BODY_BYTES = 2_000;
const noStore = { "Cache-Control": "no-store" };

/** POST /api/waitlist { email, locale, source, website } → { ok: true } | { error } */
export async function POST(request: Request) {
  const limited = await rateLimited(request, "waitlist", LIMIT);
  if (limited) return limited;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return Response.json({ error: "invalid_email" }, { status: 400, headers: noStore });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }

  const parsed = parseWaitlistBody(body, routing.locales, routing.defaultLocale);
  // Honeypot: same answer as a real sign-up, so bots learn nothing.
  if (parsed.kind === "bot") return Response.json({ ok: true }, { headers: noStore });
  if (parsed.kind === "invalid") return Response.json({ error: "invalid_email" }, { status: 400, headers: noStore });

  try {
    await joinWaitlist(parsed.signup);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    console.error("waitlist insert failed", error);
    return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
  }
}
