"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AnalyticsEvents } from "@/core/analytics";
import type { ClubSlug } from "@/core/clubs";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Problem = null | "limited" | "error";

/**
 * Join / leave a fandom club (S3 challenges & clubs). Optimistic, like Follow; the member count comes from the
 * server, so the page refreshes afterwards. Signed-out visitors get a link to sign in and come back.
 */
export function ClubJoin({
  club,
  member: initial,
  signedIn,
  next,
  via,
  className,
}: {
  club: ClubSlug;
  member: boolean;
  signedIn: boolean;
  next: string;
  via: AnalyticsEvents["club_joined"]["via"];
  className?: string;
}) {
  const t = useTranslations("Clubs");
  const router = useRouter();
  const [member, setMember] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const base = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors";

  if (!signedIn) {
    return (
      <Link href={{ pathname: "/auth", query: { next } }} className={cn(base, "bg-brand text-brand-foreground hover:bg-brand/90", className)}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {t("signInToJoin")}
      </Link>
    );
  }

  async function toggle() {
    const want = !member;
    setMember(want);
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/clubs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ club, join: want }) });
      if (!res.ok) {
        setMember(!want);
        setProblem(res.status === 429 ? "limited" : "error");
        return;
      }
      if (want) track("club_joined", { club, via });
      router.refresh();
    } catch {
      setMember(!want);
      setProblem("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      {member ? (
        <span className="flex items-center gap-1">
          <button type="button" onClick={toggle} disabled={busy} className="inline-flex h-11 items-center px-3 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
            {t("leave")}
          </button>
          <span className={cn(base, "bg-card ring-1 ring-brand/50")}>
            <CheckIcon className="size-4 text-brand" aria-hidden="true" />
            {t("joined")}
          </span>
        </span>
      ) : (
        <button type="button" onClick={toggle} disabled={busy} className={cn(base, "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90")}>
          <PlusIcon className="size-4" aria-hidden="true" />
          {t("join")}
        </button>
      )}
      <span aria-live="polite" className="text-xs text-destructive empty:hidden">
        {problem ? t("problem", { problem }) : ""}
      </span>
    </span>
  );
}
