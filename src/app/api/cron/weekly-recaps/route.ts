import { hasLocale, type Locale } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import { bearerAuthorized } from "@/app/api/_lib/http";
import { recapCtaUrl, recapEmail, type RecapCopy } from "@/core/email/recap";
import { unsubscribeLinks, unsubscribeToken } from "@/core/email/unsubscribe";
import { recapFigures, wholeMonth } from "@/core/stats/recap";
import type { CardRecap } from "@/core/cards/types";
import { localizedPath } from "@/core/auth";
import type { PushMessage } from "@/core/push";
import { BATCH_MAX, emailConfig, sendEmailBatch, sendToLocalInbox, type OutgoingEmail } from "@/data/email";
import { pushConfig, pushDueRecaps, type RecapToPush } from "@/data/push";
import { createDueRecaps, markRecapsNotified, recapsToNotify, type RecapToNotify } from "@/data/recaps";
import { routing } from "@/i18n/routing";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };
/** Users per run. More wait for the next hourly run (still Monday for them). */
const CREATE_LIMIT = 200;

/** "Sep 21 – 27" in the recipient's language. The dates are calendar dates, so they're formatted in UTC. */
const utcDate = (key: string) => new Date(`${key}T00:00:00Z`);

const recapLocale = (locale: string): Locale => (hasLocale(routing.locales, locale) ? locale : routing.defaultLocale);

/**
 * The recap's dates and numbers in the recipient's language: "Sep 21 – 27" (a week) or "September 2026" (a month),
 * "2 hours · 1 finished".
 */
async function recapWords(locale: Locale, recap: CardRecap) {
  const [tc, format] = await Promise.all([getTranslations({ locale, namespace: "Card" }), getFormatter({ locale })]);
  const month = wholeMonth(recap);
  const range = month
    ? format.dateTime(utcDate(`${month}-01`), { month: "long", year: "numeric", timeZone: "UTC" })
    : format.dateTimeRange(utcDate(recap.from), utcDate(recap.to), { month: "short", day: "numeric", timeZone: "UTC" });
  const figures = recapFigures(recap).map(({ key, value }) => ({
    value: format.number(value),
    label: key === "finished" ? tc("titlesFinished", { count: value }) : key === "episodes" ? tc("episodes", { count: value }) : tc(key),
  }));
  return { range, figures, summary: figures.map((f) => `${f.value} ${f.label}`).join(" · ") };
}

/** The notification for an installed app (ADR 0028): tapping it opens the recap card. */
async function pushFor(r: RecapToPush): Promise<PushMessage> {
  const locale = recapLocale(r.locale);
  const [t, { range, summary }] = await Promise.all([getTranslations({ locale, namespace: "Push.recap" }), recapWords(locale, r.recap)]);
  return {
    title: t("title", { range, period: r.recap.period ?? "week" }),
    body: t("body", { summary }),
    url: localizedPath(`/recap/${r.id}`, locale, routing.defaultLocale),
    tag: `recap-${r.recap.from}`,
  };
}

async function renderFor(r: RecapToNotify, secret: string, site: URL): Promise<OutgoingEmail> {
  const locale = recapLocale(r.locale);
  const [t, { range, figures, summary }] = await Promise.all([
    getTranslations({ locale, namespace: "Emails.recap" }),
    recapWords(locale, r.recap),
  ]);
  const { recap } = r;
  const period = recap.period ?? "week";
  const copy: RecapCopy = {
    subject: t("subject", { range, period }),
    preheader: t("preheader", { summary }),
    stamp: t("stamp", { period }),
    heading: t("heading", { range, period }),
    body: t("body", { titles: recap.titleCount, period }),
    cta: t("cta"),
    why: t("why"),
    unsubscribe: t("unsubscribe"),
  };
  const links = unsubscribeLinks(site, locale, routing.defaultLocale, r.userId, await unsubscribeToken(secret, r.userId, "recaps"), "recaps");
  const email = recapEmail(
    copy,
    {
      figures,
      // Smaller poster size for the email (the recap stores w342 URLs).
      posters: recap.titles.flatMap((title) => (title.posterUrl ? [{ url: title.posterUrl.replace(/\/w\d+\//, "/w185/"), alt: title.name }] : [])),
      links: {
        cta: recapCtaUrl(site, locale, routing.defaultLocale, r.id),
        unsubscribe: links.page,
        logo: new URL("/apple-icon", site).toString(),
        sender: `Mystonie · ${new URL(LEGAL.operatorSite).host.replace(/^www\./, "")}`,
      },
    },
    locale,
  );
  return {
    to: r.email,
    ...email,
    headers: { "List-Unsubscribe": `<${links.oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "campaign", value: period === "month" ? "monthly_recap" : "weekly_recap" }],
  };
}

/** Test hook: development may pass `{ now }` to act as another moment (e.g. next Monday 10:00). */
function runAt(body: unknown): Date {
  if (process.env.NODE_ENV === "production") return new Date();
  const now = (body as { now?: unknown } | null)?.now;
  const parsed = typeof now === "string" ? new Date(now) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

/**
 * POST /api/cron/weekly-recaps, `Authorization: Bearer $CRON_SECRET` → { created, pushed, sent }.
 * Called hourly by pg_cron (ADR 0025). Creates the recaps that are due (local Monday from 09:00 for last week, the
 * local 1st from 09:00 for last month, ADR 0031), pushes new ones
 * to installed apps that turned notifications on (ADR 0028), then emails the unsent ones (≤ 100 per run) with a
 * link to the recap card. Safe to call again: recaps are unique per
 * user and week, and the batch's idempotency key stops a retried send. Without email set up (and outside
 * development, where Mailpit stands in), recaps are still created and wait up to 2 days for sending.
 */
export async function POST(request: Request) {
  if (!bearerAuthorized(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const now = runAt(await request.json().catch(() => null));

  try {
    const created = await createDueRecaps(now, CREATE_LIMIT);

    // Push first and on its own: a push service outage must not hold up the emails.
    let pushed = 0;
    const vapid = pushConfig();
    if (vapid) {
      try {
        pushed = (await pushDueRecaps(vapid, pushFor, BATCH_MAX)).sent;
      } catch (error) {
        console.error("recap pushes failed", error);
      }
    }

    const config = emailConfig();
    const secret = process.env.UNSUBSCRIBE_SECRET;
    const local = !config && process.env.NODE_ENV === "development";
    // Every email carries an unsubscribe link, so no secret means no sending.
    if (!secret || (!config && !local)) return Response.json({ created, pushed, sent: 0, email: "off" }, { headers: noStore });

    const pending = await recapsToNotify(BATCH_MAX);
    if (pending.length === 0) return Response.json({ created, pushed, sent: 0 }, { headers: noStore });
    const site = siteUrl();
    const emails = await Promise.all(pending.map((r) => renderFor(r, secret, site)));
    const ids = pending.map((r) => r.id);
    if (config) await sendEmailBatch(config, emails, `recap:${ids[0]}:${ids.at(-1)}:${ids.length}`);
    else await Promise.all(emails.map(sendToLocalInbox));
    await markRecapsNotified(ids);
    return Response.json({ created, pushed, sent: ids.length }, { headers: noStore });
  } catch (error) {
    console.error("weekly recaps failed", error);
    return Response.json({ error: "failed" }, { status: 502, headers: noStore });
  }
}
