import { hasLocale } from "next-intl";
import { bearerAuthorized } from "@/app/api/_lib/http";
import { getTranslations } from "next-intl/server";
import { launchCtaUrl, launchEmail, type LaunchCopy } from "@/core/email/launch";
import { unsubscribeLinks, unsubscribeToken } from "@/core/email/unsubscribe";
import { BATCH_MAX, emailConfig, sendEmailBatch, type OutgoingEmail } from "@/data/email";
import { launchRecipients, markLaunchSent, type LaunchRecipient } from "@/data/waitlist";
import { routing } from "@/i18n/routing";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
const COPY_KEYS = ["subject", "preheader", "stamp", "heading", "body", "cta", "why", "unsubscribe"] as const;

async function renderFor(recipient: LaunchRecipient, secret: string, site: URL): Promise<OutgoingEmail> {
  const locale = hasLocale(routing.locales, recipient.locale) ? recipient.locale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Emails.launch" });
  const copy = Object.fromEntries(COPY_KEYS.map((k) => [k, t(k)])) as LaunchCopy;
  const links = unsubscribeLinks(site, locale, routing.defaultLocale, recipient.id, await unsubscribeToken(secret, recipient.id));
  const email = launchEmail(
    copy,
    {
      cta: launchCtaUrl(site),
      unsubscribe: links.page,
      logo: new URL("/apple-icon", site).toString(),
      sender: `Mystonie · ${new URL(LEGAL.operatorSite).host.replace(/^www\./, "")}`,
    },
    locale,
  );
  return {
    to: recipient.email,
    ...email,
    headers: { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "campaign", value: "launch" }],
  };
}

/**
 * POST /api/admin/launch-email { limit?: 1–100, dryRun?: boolean }, `Authorization: Bearer $ADMIN_SECRET`.
 * Sends the launch email to the next `limit` subscribed waitlist rows that haven't had it, then marks them.
 * Run it again (e.g. daily on Resend's free 100/day) until `remaining` is 0. A dry run renders the first
 * email and sends nothing. → { sent, remaining } | { dryRun, wouldSend, remaining, preview }
 */
export async function POST(request: Request) {
  if (!bearerAuthorized(request, process.env.ADMIN_SECRET)) return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });

  const body = (await request.json().catch(() => ({}))) as { limit?: unknown; dryRun?: unknown };
  const limit = Math.min(BATCH_MAX, Math.max(1, Math.floor(Number(body.limit) || BATCH_MAX)));
  const dryRun = body.dryRun === true;
  const config = emailConfig();
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret || (!config && !dryRun)) {
    return Response.json({ error: "email_not_configured" }, { status: 503, headers: noStore });
  }

  try {
    const site = siteUrl();
    const { recipients, remaining } = await launchRecipients(limit);
    const emails = await Promise.all(recipients.map((r) => renderFor(r, secret, site)));

    if (dryRun) {
      const first = emails[0];
      const preview = first && { locale: recipients[0]!.locale, subject: first.subject, text: first.text, headers: first.headers };
      return Response.json({ dryRun: true, wouldSend: emails.length, remaining, preview }, { headers: noStore });
    }
    if (emails.length === 0) return Response.json({ sent: 0, remaining: 0 }, { headers: noStore });

    const ids = recipients.map((r) => r.id);
    // Same rows → same key, so a retry after a failed markLaunchSent doesn't email anyone twice (24 h window).
    await sendEmailBatch(config!, emails, `launch:${ids[0]}:${ids.at(-1)}:${ids.length}`);
    await markLaunchSent(ids);
    return Response.json({ sent: ids.length, remaining: remaining - ids.length }, { headers: noStore });
  } catch (error) {
    console.error("launch email failed", error);
    return Response.json({ error: "send_failed" }, { status: 502, headers: noStore });
  }
}
