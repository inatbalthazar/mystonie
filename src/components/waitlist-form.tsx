"use client";

import { CheckIcon } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { EMAIL_MAX, isValidEmail, normalizeEmail, waitlistSource } from "@/core/waitlist";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Status = "idle" | "sending" | "done" | "invalid" | "rateLimited" | "error";

/** Email sign-up for the collection app. `placement` is recorded in `waitlist.source`. */
export function WaitlistForm({ placement, className }: { placement: "after_card" | "home"; className?: string }) {
  const t = useTranslations("Waitlist");
  const locale = useLocale();
  const id = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isValidEmail(normalizeEmail(email))) return setStatus("invalid");
    setStatus("sending");
    const website = new FormData(e.currentTarget).get("website");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale, website, source: waitlistSource(placement, window.location.search) }),
      });
      if (res.ok) track("waitlist_joined", { placement });
      setStatus(res.ok ? "done" : res.status === 400 ? "invalid" : res.status === 429 ? "rateLimited" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" className={cn("flex items-center gap-3 rounded-3xl bg-brand-soft p-5 text-sm font-medium", className)}>
        <CheckIcon className="size-5 shrink-0 text-brand" />
        {t("done")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-3 rounded-3xl bg-brand-soft p-5", className)}>
      <div className="flex items-start gap-3">
        <Image src="/icon.svg" alt="" width={40} height={40} unoptimized className="shrink-0" />
        <label htmlFor={`${id}-email`} className="font-display text-lg leading-snug font-bold tracking-[-0.01em]">
          {t(placement === "after_card" ? "headingAfterCard" : "heading")}
        </label>
      </div>
      <div className="flex gap-2">
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "invalid") setStatus("idle");
          }}
          placeholder={t("placeholder")}
          autoComplete="email"
          inputMode="email"
          maxLength={EMAIL_MAX}
          required
          aria-invalid={status === "invalid"}
          aria-describedby={`${id}-note`}
          className="h-12 min-w-0 flex-1 rounded-xl border border-input bg-card px-4 text-base outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:border-destructive"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-12 shrink-0 rounded-full bg-brand px-5 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90 disabled:opacity-60 press"
        >
          {t("join")}
        </button>
      </div>
      {/* Honeypot: invisible to people, tempting to bots. Filled = silently dropped by the server. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>{t("honeypot")}</label>
        <input id={`${id}-website`} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <p id={`${id}-note`} aria-live="polite" className={cn("text-xs", status === "idle" || status === "sending" ? "text-muted-foreground" : "text-destructive")}>
        {status === "invalid"
          ? t("invalid")
          : status === "rateLimited"
            ? t("rateLimited")
            : status === "error"
              ? t("error")
              : t.rich("consent", {
                  privacy: (chunks) => (
                    <Link href="/privacy" className="underline underline-offset-2">
                      {chunks}
                    </Link>
                  ),
                })}
      </p>
    </form>
  );
}
