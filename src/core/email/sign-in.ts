// The sign-in email Supabase Auth asks us to send through the Send Email Hook (ADR 0020): a 6-digit code
// (typed in the app, which also works inside an installed PWA) plus a link for the same device.
import { button, emailShell, escapeHtml, FONT, heading, INK, paragraph, stamp, type RenderedEmail } from "./layout";

export type SignInCopy = {
  /** Includes the code, so it shows in the inbox preview. */
  subject: string;
  preheader: string;
  stamp: string;
  heading: string;
  body: string;
  cta: string;
  expiry: string;
  ignore: string;
};

/** Supabase email action types that are a sign-in for us (new users get `signup`, others `magiclink`). */
export const SIGN_IN_ACTIONS = ["signup", "magiclink", "email"] as const;
export type SignInAction = (typeof SIGN_IN_ACTIONS)[number];

export function isSignInAction(action: string): action is SignInAction {
  return (SIGN_IN_ACTIONS as readonly string[]).includes(action);
}

/**
 * The link in the email. It opens our confirm page (`redirectTo`, validated by Supabase against the redirect
 * allow list), which signs in only after a tap, so mail scanners that open links don't use up the code.
 */
export function signInLink(redirectTo: string, fallback: URL, tokenHash: string, action: SignInAction): string {
  let url: URL;
  try {
    url = new URL(redirectTo);
  } catch {
    url = fallback;
  }
  if (!/\/auth\/confirm$/.test(url.pathname)) url = fallback;
  url = new URL(url);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", action);
  return url.toString();
}

export function signInEmail(copy: SignInCopy, opts: { code: string; link: string; logo: string; sender: string }, lang: string): RenderedEmail {
  const { subject } = copy;
  const code = `<p style="margin:0 0 24px;font-family:${FONT};font-size:36px;line-height:1;font-weight:800;letter-spacing:8px;color:${INK};">${escapeHtml(opts.code)}</p>`;
  const small = (text: string) =>
    `<p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${INK};opacity:0.7;">${escapeHtml(text)}</p>`;
  const html = emailShell({
    lang,
    title: subject,
    preheader: copy.preheader,
    logo: opts.logo,
    body: [stamp(copy.stamp), heading(copy.heading), paragraph(copy.body, 20), code, button(copy.cta, opts.link), small(copy.expiry)].join("\n"),
    footer: `${escapeHtml(copy.ignore)}<br>${escapeHtml(opts.sender)}`,
  });
  const text = [copy.heading, "", copy.body, "", opts.code, "", `${copy.cta}: ${opts.link}`, "", copy.expiry, "", "--", copy.ignore, opts.sender].join("\n");
  return { subject, html, text };
}
