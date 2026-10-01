// Beta reports (ADR 0055): "Report a problem". Server only: filed with the service role, read back by the reporter
// through RLS.
import { feedbackEmail, type FeedbackFrom } from "@/core/email/feedback";
import { isFeedbackKind, isFeedbackStatus, type Feedback, type FeedbackKind, type FeedbackStatus } from "@/core/feedback";
import { uuidv7 } from "@/core/ids";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";
import { emailConfig, sendEmail, sendToLocalInbox } from "./email";
import { adminClient } from "./supabase-admin";
import type { UserClient } from "./supabase-server";

/**
 * Stores a report and emails the operator (Resend when configured, Mailpit in development). The email is best
 * effort: the row is what counts.
 */
export async function fileFeedback(feedback: Feedback, from: FeedbackFrom): Promise<void> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  const id = uuidv7();
  const { error } = await db.from("feedback").insert({
    id,
    user_id: from.userId,
    kind: feedback.kind,
    message: feedback.message,
    page: feedback.page,
    error_ref: feedback.errorRef,
    device: from.device,
    locale: from.locale,
  });
  if (error) throw new Error(`feedback insert failed: ${error.message}`);

  const rendered = feedbackEmail({ ...feedback, id }, from, feedback.page && new URL(feedback.page, siteUrl()).toString());
  const email = { to: LEGAL.contactEmail, ...rendered };
  const config = emailConfig();
  try {
    if (config) await sendEmail(config, email, `feedback-${id}`);
    else if (process.env.NODE_ENV === "development") await sendToLocalInbox(email);
  } catch (e) {
    console.error("feedback notification failed", e);
  }
}

export type MyFeedback = { id: string; kind: FeedbackKind; message: string; status: FeedbackStatus; createdAt: string };

/** The signed-in user's latest reports, newest first (RLS: their own). */
export async function myFeedback(db: UserClient, limit = 20): Promise<MyFeedback[]> {
  const { data, error } = await db
    .from("feedback")
    .select("id, kind, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`feedback read failed: ${error.message}`);
  return data.flatMap((r) =>
    isFeedbackKind(r.kind) && isFeedbackStatus(r.status) ? [{ id: r.id, kind: r.kind, message: r.message, status: r.status, createdAt: r.created_at }] : [],
  );
}
