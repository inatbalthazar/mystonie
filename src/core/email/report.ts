// The notification the operator gets for a new report (S1 profile & privacy → Safety). Internal, so English
// only and plain: what was reported, why, and a link to it.
import type { Report } from "../reports";
import { escapeHtml, type RenderedEmail } from "./layout";

export function reportEmail(report: Report & { id: string }, targetUrl: string | null): RenderedEmail {
  const what = report.targetKind === "card" ? "card" : "profile";
  const lines = [
    `Reason: ${report.reason}`,
    `Note: ${report.note ?? "(none)"}`,
    `Link: ${targetUrl ?? "(no longer public)"}`,
    `Report id: ${report.id}`,
    "",
    `Mark it handled: update public.reports set resolved_at = now() where id = '${report.id}';`,
  ];
  return {
    subject: `Report: ${what} (${report.reason})`,
    text: lines.join("\n"),
    html: `<pre style="font:14px/1.5 monospace;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</pre>`,
  };
}
