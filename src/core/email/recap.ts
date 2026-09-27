// The Weekly Recap email (ADR 0025): the week's numbers, a strip of posters and a button to the recap card,
// which renders in the browser (ADR 0008). Copy and numbers arrive already translated and formatted
// (messages/*.json, namespace Emails.recap), so this stays free of next-intl.
import { button, CORAL, emailShell, escapeHtml, FONT, heading, INK, MUTED, paragraph, stamp, type RenderedEmail } from "./layout";

export type RecapCopy = {
  subject: string;
  preheader: string;
  stamp: string;
  heading: string;
  body: string;
  cta: string;
  why: string;
  unsubscribe: string;
};

/** One big number with its label ("9" "hours"). */
export type RecapFigure = { value: string; label: string };

export type RecapLinks = {
  /** The recap page (see `recapCtaUrl`). */
  cta: string;
  /** The confirm page from `unsubscribeLinks(…, "recaps").page`. */
  unsubscribe: string;
  logo: string;
  sender: string;
};

/** The recap page, with the campaign tags the analytics landing attribution reads. */
export function recapCtaUrl(site: URL, locale: string, defaultLocale: string, recapId: string): string {
  const url = new URL(`${locale === defaultLocale ? "" : `/${locale}`}/recap/${recapId}`, site);
  url.search = new URLSearchParams({ utm_source: "recap", utm_medium: "email", utm_campaign: "weekly_recap" }).toString();
  return url.toString();
}

function figures(items: RecapFigure[]): string {
  if (items.length === 0) return "";
  const cells = items
    .map(
      (f) => `<td valign="top" style="padding:0 8px 0 0;">
<p style="margin:0;font-family:${FONT};font-size:40px;line-height:1;font-weight:800;letter-spacing:-1px;color:${INK};">${escapeHtml(f.value)}</p>
<p style="margin:6px 0 0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};">${escapeHtml(f.label)}</p>
</td>`,
    )
    .join("\n");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-top:3px solid ${INK};padding-top:16px;"><tr>
${cells}
</tr></table>`;
}

/** Posters pasted in a row (email clients don't rotate reliably, so the scrapbook feel is the white frames). */
function posterStrip(posters: { url: string; alt: string }[]): string {
  if (posters.length === 0) return "";
  const cells = posters
    .map(
      (p) =>
        `<td style="padding:0 8px 0 0;"><img src="${escapeHtml(p.url)}" width="92" height="138" alt="${escapeHtml(p.alt)}" style="display:block;border:4px solid #ffffff;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.18);background:${CORAL};"></td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>${cells}</tr></table>`;
}

export function recapEmail(
  copy: RecapCopy,
  opts: { figures: RecapFigure[]; posters: { url: string; alt: string }[]; links: RecapLinks },
  lang: string,
): RenderedEmail {
  const e = escapeHtml;
  const { links } = opts;
  const html = emailShell({
    lang,
    title: copy.subject,
    preheader: copy.preheader,
    logo: links.logo,
    body: [stamp(copy.stamp), heading(copy.heading), figures(opts.figures), posterStrip(opts.posters), paragraph(copy.body), button(copy.cta, links.cta)].join(
      "\n",
    ),
    footer: `${e(copy.why)} <a href="${e(links.unsubscribe)}" style="color:${MUTED};text-decoration:underline;">${e(copy.unsubscribe)}</a><br>${e(links.sender)}`,
  });

  const text = [
    copy.heading,
    "",
    opts.figures.map((f) => `${f.value} ${f.label}`).join(" · "),
    "",
    copy.body,
    "",
    `${copy.cta}: ${links.cta}`,
    "",
    "--",
    copy.why,
    `${copy.unsubscribe}: ${links.unsubscribe}`,
    links.sender,
  ].join("\n");
  return { subject: copy.subject, html, text };
}
