"use client";

import { FlagIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { REPORT_NOTE_MAX, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/core/reports";
import { cn } from "@/lib/utils";
import { Sheet } from "./sheet";

type Status = "idle" | "sending" | "done" | "error" | "limited" | "gone";

/** "Report" on a public profile or shared card: a reason and an optional note, no account needed (POST /api/reports). */
export function ReportButton({ targetKind, targetId, className }: { targetKind: ReportTarget; targetId: string; className?: string }) {
  const t = useTranslations("Report");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reason) return;
    const website = new FormData(e.currentTarget).get("website");
    setStatus("sending");
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetKind, targetId, reason, note, website }),
      });
      setStatus(res.ok ? "done" : res.status === 429 ? "limited" : res.status === 404 ? "gone" : "error");
    } catch {
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    if (status === "done") {
      setReason(null);
      setNote("");
      setStatus("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("inline-flex h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground", className)}
      >
        <FlagIcon className="size-4" aria-hidden="true" />
        {t("button")}
      </button>
      <Sheet open={open} onClose={close} title={t("title", { kind: targetKind })} closeLabel={t("close")}>
        {status === "done" ? (
          <p role="status" className="rounded-2xl bg-muted p-4 font-medium">
            {t("done")}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-2 font-semibold">{t("reasonLabel")}</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 hover:bg-muted has-checked:bg-brand-soft">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="size-5 accent-brand"
                  />
                  {t("reason", { reason: r })}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-note`} className="text-sm font-semibold">
                {t("noteLabel")}
              </label>
              <textarea
                id={`${id}-note`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={REPORT_NOTE_MAX}
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring"
              />
            </div>
            {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
              <label>
                {t("honeypot")}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <button
              type="submit"
              disabled={!reason || status === "sending"}
              className="h-12 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50 press"
            >
              {status === "sending" ? t("sending") : t("submit")}
            </button>
            <p aria-live="polite" className="text-sm text-destructive">
              {status === "error" ? t("error") : status === "limited" ? t("limited") : status === "gone" ? t("gone") : ""}
            </p>
          </form>
        )}
      </Sheet>
    </>
  );
}
