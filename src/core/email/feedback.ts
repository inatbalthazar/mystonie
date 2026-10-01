// The notification the operator gets for a beta report (ADR 0055). Internal, so English only and plain: what was
// reported, from where, by whom, and how to mark it.
import type { Feedback } from "../feedback";
import { escapeHtml, type RenderedEmail } from "./layout";

export type FeedbackFrom = { userId: string | null; email: string | null; device: string | null; locale: string };

export function feedbackEmail(feedback: Feedback & { id: string }, from: FeedbackFrom, pageUrl: string | null): RenderedEmail {
  const firstLine = feedback.message.split("\n", 1)[0]!;
  const lines = [
    feedback.message,
    "",
    "---",
    `Kind: ${feedback.kind}`,
    `Page: ${pageUrl ?? "(not given)"}`,
    ...(feedback.errorRef ? [`Error digest: ${feedback.errorRef}`] : []),
    `From: ${from.email ?? "(signed out)"}${from.userId ? ` (${from.userId})` : ""}`,
    `Language: ${from.locale}`,
    `Device: ${from.device ?? "(unknown)"}`,
    `Report id: ${feedback.id}`,
    "",
    `Update what they see: update public.feedback set status = 'fixed' where id = '${feedback.id}'; -- or 'planned', 'closed'`,
  ];
  return {
    subject: `Beta ${feedback.kind}: ${[...firstLine].length > 60 ? `${[...firstLine].slice(0, 60).join("")}…` : firstLine}`,
    text: lines.join("\n"),
    html: `<pre style="font:14px/1.5 monospace;white-space:pre-wrap">${escapeHtml(lines.join("\n"))}</pre>`,
  };
}
