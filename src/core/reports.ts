// "Report" on public profiles and shared cards (S1 profile & privacy → Safety) and on members' Journal articles
// (ADR 0092). The reasons match the `reports.reason` check in the database.
import { isUuid } from "./email/unsubscribe";

export const REPORT_REASONS = ["spam", "harassment", "hate", "sexual", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGETS = ["profile", "card", "article"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_NOTE_MAX = 500;

export type Report = { targetKind: ReportTarget; targetId: string; reason: ReportReason; note: string | null };

export type ReportParse = { kind: "ok"; report: Report } | { kind: "bot" } | { kind: "invalid" };

/** Validates a POST /api/reports body `{ targetKind, targetId, reason, note?, website? }` (`website` is the honeypot). */
export function parseReport(body: unknown): ReportParse {
  if (typeof body !== "object" || body === null) return { kind: "invalid" };
  const b = body as Record<string, unknown>;
  if (typeof b.website === "string" && b.website.trim() !== "") return { kind: "bot" };
  if (!(REPORT_TARGETS as readonly unknown[]).includes(b.targetKind)) return { kind: "invalid" };
  if (typeof b.targetId !== "string" || !isUuid(b.targetId)) return { kind: "invalid" };
  if (!(REPORT_REASONS as readonly unknown[]).includes(b.reason)) return { kind: "invalid" };
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== "string") return { kind: "invalid" };
    const trimmed = b.note.trim();
    if ([...trimmed].length > REPORT_NOTE_MAX) return { kind: "invalid" };
    note = trimmed || null;
  }
  return {
    kind: "ok",
    report: {
      targetKind: b.targetKind as ReportTarget,
      targetId: b.targetId.toLowerCase(),
      reason: b.reason as ReportReason,
      note,
    },
  };
}
