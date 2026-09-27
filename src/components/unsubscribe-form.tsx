"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { EmailList } from "@/core/email/unsubscribe";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "done" | "invalid" | "error";

/**
 * Confirm step for the link in our emails: nothing changes until the button is pressed. `list` is which
 * emails stop (null = an unknown list in the link, shown as broken).
 */
export function UnsubscribeForm({ id, token, list }: { id: string; token: string; list: EmailList | null }) {
  const t = useTranslations("Unsubscribe");
  const [status, setStatus] = useState<Status>(id && token && list ? "idle" : "invalid");
  const recaps = list === "recaps";

  async function unsubscribe() {
    setStatus("sending");
    try {
      const query = new URLSearchParams({ id, t: token, ...(recaps ? { list: "recaps" } : {}) });
      const res = await fetch(`/api/unsubscribe?${query}`, { method: "POST" });
      setStatus(res.ok ? "done" : res.status === 400 ? "invalid" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className="flex items-center gap-3 rounded-3xl bg-brand-soft p-5 font-medium">
        <CheckIcon className="size-5 shrink-0 text-brand" />
        {recaps ? t("doneRecaps") : t("done")}
      </p>
    );
  }
  if (status === "invalid") return <p className="rounded-3xl bg-muted p-5">{t("invalid")}</p>;

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
      <p>{recaps ? t("promptRecaps") : t("prompt")}</p>
      <button
        type="button"
        onClick={unsubscribe}
        disabled={status === "sending"}
        className="h-12 rounded-xl bg-foreground px-5 font-semibold text-background hover:bg-foreground/90 disabled:opacity-60"
      >
        {t("button")}
      </button>
      <p aria-live="polite" className={cn("text-sm text-destructive", status !== "error" && "sr-only")}>
        {status === "error" ? t("error") : ""}
      </p>
    </div>
  );
}
