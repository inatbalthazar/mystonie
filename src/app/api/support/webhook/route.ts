import { parseTipEvent } from "@/core/support";
import { awardSupporter } from "@/data/badges";
import { tipWebhookSecret, verifyTip } from "@/data/support";

const MAX_BODY_BYTES = 64_000;
const noStore = { "Cache-Control": "no-store" };

/**
 * POST /api/support/webhook (Buy Me a Coffee → us; ADR 0063). A tip or a membership, verified against
 * `BMC_WEBHOOK_SECRET`, gives the Supporter sticker to the Mystonie account with the supporter's email. The email
 * isn't stored; a tip from an email with no account changes nothing (`matched: false`). Other events get 200 and are
 * ignored. 503 without the secret, 400 for anything not signed by Buy Me a Coffee, 500 when saving fails (it retries).
 */
export async function POST(request: Request) {
  const secret = tipWebhookSecret();
  if (!secret) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "invalid" }, { status: 400, headers: noStore });
  const body = verifyTip(raw, request.headers.get("x-signature-sha256"), secret);
  if (body === null) return Response.json({ error: "invalid_signature" }, { status: 400, headers: noStore });

  const tip = parseTipEvent(body, Date.now());
  if (!tip) return Response.json({ received: true, ignored: true }, { headers: noStore });
  try {
    const matched = await awardSupporter(tip.email, tip.at);
    if (matched === null) return Response.json({ error: "unavailable" }, { status: 503, headers: noStore });
    return Response.json({ received: true, matched }, { headers: noStore });
  } catch (error) {
    console.error("tip webhook", error);
    return Response.json({ error: "unavailable" }, { status: 500, headers: noStore });
  }
}
