// Reports on public profiles and shared cards (S1 profile & privacy → Safety, ADR 0027). Server only.
import { reportEmail } from "@/core/email/report";
import { uuidv7 } from "@/core/ids";
import type { Report } from "@/core/reports";
import { LEGAL } from "@/lib/legal";
import { siteUrl } from "@/lib/site";
import { emailConfig, sendEmail, sendToLocalInbox } from "./email";
import { adminClient } from "./supabase-admin";

/** The public page of a report target, or null when it isn't public (any more): only public things can be reported. */
async function targetPath(report: Report): Promise<string | null> {
  const db = adminClient();
  if (!db) return null;
  if (report.targetKind === "card") {
    const { data, error } = await db
      .from("cards")
      .select("id")
      .eq("id", report.targetId)
      .not("shared_at", "is", null)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(`cards read failed: ${error.message}`);
    return data ? `/c/${data.id}` : null;
  }
  const { data, error } = await db
    .from("profiles")
    .select("username")
    .eq("id", report.targetId)
    .eq("visibility", "public")
    .maybeSingle();
  if (error) throw new Error(`profiles read failed: ${error.message}`);
  return data ? `/u/${data.username}` : null;
}

/**
 * Stores a report and emails the operator (Resend when configured, Mailpit in development). The email is best
 * effort: the row is what counts. Returns false when the target isn't a public profile or shared card.
 */
export async function fileReport(report: Report, reporterId: string | null): Promise<boolean> {
  const db = adminClient();
  if (!db) throw new Error("Supabase is not configured");
  const path = await targetPath(report);
  if (!path) return false;

  const id = uuidv7();
  const { error } = await db.from("reports").insert({
    id,
    reporter_id: reporterId,
    target_kind: report.targetKind,
    target_id: report.targetId,
    reason: report.reason,
    note: report.note,
  });
  if (error) throw new Error(`reports insert failed: ${error.message}`);

  const rendered = reportEmail({ ...report, id }, new URL(path, siteUrl()).toString());
  const email = { to: LEGAL.contactEmail, ...rendered };
  const config = emailConfig();
  try {
    if (config) await sendEmail(config, email, `report-${id}`);
    else if (process.env.NODE_ENV === "development") await sendToLocalInbox(email);
  } catch (e) {
    console.error("report notification failed", e);
  }
  return true;
}
