"use client";

import { StampIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * The Stamp (S3 social): kudos on someone's finish, pressed like a rubber stamp onto the album page. Tapping again
 * takes it back. On your own finish it only shows how many Stamps you got.
 */
export function StampButton({
  entryId,
  stamped: initial,
  count: initialCount,
  mine,
  compact = false,
}: {
  entryId: string;
  stamped: boolean;
  count: number;
  mine: boolean;
  /** Icon and number only, for tight rows (Home). */
  compact?: boolean;
}) {
  const t = useTranslations("Social");
  const [stamped, setStamped] = useState(initial);
  const [count, setCount] = useState(initialCount);
  const [justStamped, setJustStamped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);

  if (mine) {
    return count > 0 ? (
      <span className="inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-brand">
        <StampIcon className="size-4" aria-hidden="true" />
        {t("stampCount", { count })}
      </span>
    ) : null;
  }

  async function toggle() {
    const want = !stamped;
    setStamped(want);
    setCount((c) => c + (want ? 1 : -1));
    setJustStamped(want);
    setBusy(true);
    setProblem(false);
    try {
      const res = await fetch("/api/stamps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId, stamped: want }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (want) track("stamped", {});
    } catch {
      setStamped(!want);
      setCount((c) => c + (want ? -1 : 1));
      setJustStamped(false);
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={stamped}
        aria-label={stamped ? t("unstamp") : t("stamp")}
        className={cn(
          "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 font-display text-sm font-extrabold tracking-[0.12em] uppercase transition-colors [&:lang(th)]:tracking-normal",
          stamped
            ? "border-2 border-brand text-brand"
            : "border-2 border-dashed border-border text-muted-foreground hover:border-brand/60 hover:text-brand",
          // The stamp animation ends tilted by itself (-8deg); otherwise tilt it here.
          stamped && (justStamped ? "motion-safe:animate-stamp motion-reduce:rotate-[-8deg]" : "rotate-[-8deg]"),
        )}
      >
        <StampIcon className={compact ? "size-5" : "size-4"} aria-hidden="true" />
        {!compact && (stamped ? t("stamped") : t("stamp"))}
      </button>
      {count > 0 && (
        <span className="text-sm font-semibold tabular-nums text-muted-foreground">
          {compact ? (
            <>
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">{t("stampCount", { count })}</span>
            </>
          ) : (
            t("stampCount", { count })
          )}
        </span>
      )}
      <span aria-live="polite" className="text-xs text-destructive empty:hidden">
        {problem ? t("problem", { problem: "error" }) : ""}
      </span>
    </span>
  );
}
