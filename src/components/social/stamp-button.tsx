"use client";

import { StampIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AnalyticsEvents } from "@/core/analytics";
import { Link } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const face =
  "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 font-display text-sm font-extrabold tracking-[0.12em] uppercase transition-colors [&:lang(th)]:tracking-normal";
const unpressed = "border-2 border-dashed border-border text-muted-foreground hover:border-brand/60 hover:text-brand";

/**
 * The Stamp (S3 social): kudos on someone's finish, pressed like a rubber stamp onto the album page. Tapping again
 * takes it back. On your own finish it only shows how many Stamps you got. With `article`, it stamps a Journal article
 * instead (ADR 0052), and `signInNext` makes it a link to sign in (and come back) for visitors.
 */
export function StampButton({
  entryId,
  article,
  stamped: initial,
  count: initialCount,
  mine,
  compact = false,
  signInNext,
}: {
  entryId?: string;
  article?: { slug: string; place: AnalyticsEvents["article_stamped"]["place"] };
  stamped: boolean;
  count: number;
  mine: boolean;
  /** Icon and number only, for tight rows (Home, the Journal). */
  compact?: boolean;
  /** Signed out: where to come back to after signing in. */
  signInNext?: string;
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
      const res = await fetch(article ? "/api/journal/marks" : "/api/stamps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(article ? { slug: article.slug, kind: "stamp", on: want } : { entryId, stamped: want }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (want) {
        if (article) track("article_stamped", { place: article.place });
        else track("stamped", {});
      }
    } catch {
      setStamped(!want);
      setCount((c) => c + (want ? -1 : 1));
      setJustStamped(false);
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }

  const label = compact ? null : stamped ? t("stamped") : t("stamp");
  const counted = count > 0 && (
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
  );

  if (signInNext !== undefined) {
    return (
      <span className="inline-flex items-center gap-2">
        <Link href={{ pathname: "/auth", query: { next: signInNext } }} aria-label={t("stamp")} className={cn(face, unpressed)}>
          <StampIcon className={compact ? "size-5" : "size-4"} aria-hidden="true" />
          {label}
        </Link>
        {counted}
      </span>
    );
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
          face,
          stamped ? "border-2 border-brand text-brand" : unpressed,
          // The stamp animation ends tilted by itself (-8deg); otherwise tilt it here.
          stamped && (justStamped ? "motion-safe:animate-stamp motion-reduce:rotate-[-8deg]" : "rotate-[-8deg]"),
        )}
      >
        <StampIcon className={compact ? "size-5" : "size-4"} aria-hidden="true" />
        {label}
      </button>
      {counted}
      <span aria-live="polite" className="text-xs text-destructive empty:hidden">
        {problem ? t("problem", { problem: "error" }) : ""}
      </span>
    </span>
  );
}
