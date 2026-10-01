// "Report a problem" while Mystonie is in beta (ADR 0055): a bug, an idea or anything else, sent to the operator.
// The kinds and statuses match the `feedback` checks in the database.

export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const isFeedbackKind = (v: unknown): v is FeedbackKind => (FEEDBACK_KINDS as readonly unknown[]).includes(v);

/** Set by the operator (Supabase dashboard); the reporter sees it under "Your reports". */
export const FEEDBACK_STATUSES = ["new", "planned", "fixed", "closed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const isFeedbackStatus = (v: unknown): v is FeedbackStatus => (FEEDBACK_STATUSES as readonly unknown[]).includes(v);

export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_PAGE_MAX = 300;
/** An error page's digest, to match the server's logs. */
const ERROR_REF = /^[A-Za-z0-9_-]{1,64}$/;

export type Feedback = { kind: FeedbackKind; message: string; page: string | null; errorRef: string | null };

export type FeedbackParse = { kind: "ok"; feedback: Feedback } | { kind: "bot" } | { kind: "invalid" };

/**
 * The page a report was sent from, as a path on this site without its query or hash (they can hold sign-in or
 * unsubscribe tokens), or null. "/th/title/movie/1?x=1" → "/th/title/movie/1".
 */
export function feedbackPage(from: unknown): string | null {
  if (typeof from !== "string" || !from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return null;
  const path = from.split(/[?#]/, 1)[0]!;
  if (path.length > FEEDBACK_PAGE_MAX || /[\s\p{Cc}]/u.test(path)) return null;
  return path;
}

/** Validates a POST /api/feedback body `{ kind, message, page?, errorRef?, website? }` (`website` is the honeypot). */
export function parseFeedback(body: unknown): FeedbackParse {
  if (typeof body !== "object" || body === null) return { kind: "invalid" };
  const b = body as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim() !== "") return { kind: "bot" };
  if (!isFeedbackKind(b.kind) || typeof b.message !== "string") return { kind: "invalid" };
  const message = b.message.trim();
  if (!message || [...message].length > FEEDBACK_MESSAGE_MAX) return { kind: "invalid" };
  const errorRef = typeof b.errorRef === "string" && ERROR_REF.test(b.errorRef) ? b.errorRef : null;
  return { kind: "ok", feedback: { kind: b.kind, message, page: feedbackPage(b.page), errorRef } };
}

/** The browser's user agent, cut to what the database keeps. */
export const feedbackDevice = (userAgent: string | null): string | null => userAgent?.trim().slice(0, 300) || null;
