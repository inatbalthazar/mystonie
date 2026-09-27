// Shared frame for our emails: tables and inline styles, as email clients need. Copy is passed in
// already translated (messages/*.json), so this stays free of next-intl.

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Brand tokens from globals.css (light theme), as hex because email clients don't read CSS variables.
export const PAPER = "#fcfaf6";
export const INK = "#1d1713";
export const MUTED = "#6b625a";
export const CORAL = "#cf3c12";
export const CARD = "#ffffff";
export const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

/** The coral outlined stamp above a heading. Tracking suits Latin capitals; it pulls apart scripts like Thai. */
export function stamp(label: string): string {
  const tracking = /^[ -~]+$/.test(label) ? "3px" : "0";
  return `<p style="margin:0 0 20px;"><span style="display:inline-block;border:2px solid ${CORAL};border-radius:6px;padding:4px 10px;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:${tracking};color:${CORAL};">${escapeHtml(label)}</span></p>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.5px;color:${INK};">${escapeHtml(text)}</h1>`;
}

export function paragraph(text: string, marginBottom = 28): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT};font-size:16px;line-height:1.55;color:${INK};">${escapeHtml(text)}</p>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:14px;background:${CORAL};">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

/**
 * Page frame: logo line, a white card with `body` (trusted HTML built from the helpers above) and a muted
 * footer (`footer` is trusted HTML too).
 */
export function emailShell(opts: { lang: string; title: string; preheader: string; logo: string; body: string; footer: string }): string {
  const e = escapeHtml;
  return `<!doctype html>
<html lang="${e(opts.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${e(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="padding:0 4px 20px;font-family:${FONT};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${INK};">
<img src="${e(opts.logo)}" width="32" height="32" alt="" style="vertical-align:middle;border:0;margin-right:8px;">mystonie
</td></tr>
<tr><td style="background:${CARD};border:1px solid #e8e1d8;border-radius:16px;padding:32px 28px;">
${opts.body}
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${MUTED};">
${opts.footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
