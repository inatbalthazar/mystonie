"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX, type FeedbackKind } from "@/core/feedback";
import { track } from "@/lib/analytics";
import { useRouter } from "@/i18n/navigation";

type Status = "idle" | "sending" | "done" | "error" | "limited";

/** "Report a problem" (ADR 0055): a kind, a message, and the page it came from (POST /api/feedback). No account needed. */
export function FeedbackForm({ initialKind, page, errorRef, signedIn }: { initialKind: FeedbackKind; page: string | null; errorRef: string | null; signedIn: boolean }) {
  const t = useTranslations("Beta");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [kind, setKind] = useState<FeedbackKind>(initialKind);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!message.trim()) return;
    const website = new FormData(e.currentTarget).get("website");
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, page, errorRef, locale, website }),
      });
      setStatus(res.ok ? "done" : res.status === 429 ? "limited" : "error");
      if (res.ok) {
        track("feedback_sent", { kind });
        setMessage("");
        if (signedIn) router.refresh(); // "Your reports" below
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-2xl bg-brand-soft/60 p-5">
        <p className="font-hand text-2xl">{t("done")}</p>
        <button type="button" onClick={() => setStatus("idle")} className="h-11 rounded-full px-4 font-semibold ring-1 ring-border hover:bg-muted press">
          {t("another")}
        </button>
      </div>
    );
  }

  const left = FEEDBACK_MESSAGE_MAX - [...message].length;
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">{t("kindLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {FEEDBACK_KINDS.map((k) => (
            <label
              key={k}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 ring-1 ring-border hover:bg-muted has-checked:bg-brand-soft has-checked:ring-brand has-focus-visible:ring-2"
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {t("kind", { kind: k })}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-message`} className="text-sm font-semibold">
          {t("messageLabel", { kind })}
        </label>
        <textarea
          id={`${id}-message`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          placeholder={t("messagePlaceholder", { kind })}
          aria-describedby={`${id}-hint`}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ring"
        />
        <p id={`${id}-hint`} className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>{t("hint")}</span>
          {left < 200 && <span className={left < 0 ? "text-destructive" : undefined}>{left}</span>}
        </p>
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
        disabled={!message.trim() || left < 0 || status === "sending"}
        className="h-12 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-50 press"
      >
        {status === "sending" ? t("sending") : t("submit")}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-destructive">
        {status === "error" ? t("error") : status === "limited" ? t("limited") : ""}
      </p>
    </form>
  );
}
