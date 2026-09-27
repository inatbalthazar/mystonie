// The waitlist launch email: plain HTML plus a text part. Copy comes from messages/*.json
// (namespace Emails.launch), so this stays free of next-intl.
import { button, emailShell, escapeHtml, heading, MUTED, paragraph, stamp, type RenderedEmail } from "./layout";

export { escapeHtml, type RenderedEmail } from "./layout";

export type LaunchCopy = {
  subject: string;
  preheader: string;
  stamp: string;
  heading: string;
  body: string;
  cta: string;
  why: string;
  unsubscribe: string;
};

export type LaunchLinks = {
  /** Where the button goes (with campaign attribution, see `launchCtaUrl`). */
  cta: string;
  /** The confirm page from `unsubscribeLinks().page`. */
  unsubscribe: string;
  /** Absolute URL of a PNG logo (email clients don't show SVG). */
  logo: string;
  /** Footer line identifying the sender, e.g. "Mystonie · codenat.me". */
  sender: string;
};

/** Site URL with the campaign tags the analytics landing attribution reads. */
export function launchCtaUrl(site: URL): string {
  const url = new URL("/", site);
  url.search = new URLSearchParams({ utm_source: "waitlist", utm_medium: "email", utm_campaign: "launch" }).toString();
  return url.toString();
}

export function launchEmail(copy: LaunchCopy, links: LaunchLinks, lang: string): RenderedEmail {
  const e = escapeHtml;
  const html = emailShell({
    lang,
    title: copy.subject,
    preheader: copy.preheader,
    logo: links.logo,
    body: [stamp(copy.stamp), heading(copy.heading), paragraph(copy.body), button(copy.cta, links.cta)].join("\n"),
    footer: `${e(copy.why)} <a href="${e(links.unsubscribe)}" style="color:${MUTED};text-decoration:underline;">${e(copy.unsubscribe)}</a><br>${e(links.sender)}`,
  });

  const text = [copy.heading, "", copy.body, "", `${copy.cta}: ${links.cta}`, "", "--", copy.why, `${copy.unsubscribe}: ${links.unsubscribe}`, links.sender].join("\n");
  return { subject: copy.subject, html, text };
}
