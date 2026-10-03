"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { REVIEW_NOTE_MAX, type ReviewAction } from "@/core/journal-posts";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The team's buttons on an article in /admin/journal (ADR 0092): Feature it or Not this time for one sent to be
 * Featured, Take down or Put back for a reported one, with an optional note the writer sees. POST /api/admin/journal.
 */
export function ReviewActions({ id, actions }: { id: string; actions: readonly ReviewAction[] }) {
  const t = useTranslations("JournalAdmin");
  const router = useRouter();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: true; action: ReviewAction } | { ok: false } | null>(null);

  async function act(action: ReviewAction) {
    setBusy(true);
    const res = await fetch("/api/admin/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, note: note.trim() || null }),
    }).catch(() => null);
    setBusy(false);
    setResult(res?.ok ? { ok: true, action } : { ok: false });
    if (res?.ok) router.refresh();
  }

  const label = { approve: t("approve"), decline: t("decline"), hide: t("hide"), unhide: t("unhide") };
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={noteId} className="text-sm font-semibold">
        {t("noteLabel")}
      </label>
      <textarea
        id={noteId}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={REVIEW_NOTE_MAX}
        rows={2}
        className="w-full rounded-xl bg-background p-3 text-sm ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => void act(action)}
            className={cn(
              "flex h-11 items-center rounded-full px-5 text-sm font-bold press disabled:opacity-50",
              action === "approve" || action === "unhide" ? "bg-brand text-brand-foreground" : action === "hide" ? "bg-destructive text-white" : "bg-card ring-1 ring-border",
            )}
          >
            {label[action]}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
        {result?.ok === true && t("done", { action: result.action })}
        {result?.ok === false && t("error")}
      </p>
    </div>
  );
}
