"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { AnalyticsEvents } from "@/core/analytics";
import { Link, useRouter } from "@/i18n/navigation";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Problem = null | "error" | "limited" | "gone";

/**
 * Follow / Following (S3 social). Optimistic: the button flips at once and flips back if the server says no.
 * Signed-out visitors get a link to sign in and come back (`next`).
 */
export function FollowButton({
  userId,
  following: initial,
  via,
  next,
  signedIn = true,
  className,
}: {
  userId: string;
  following: boolean;
  via: AnalyticsEvents["followed"]["via"];
  /** Where to come back to after signing in (signed-out visitors only). */
  next?: string;
  signedIn?: boolean;
  className?: string;
}) {
  const t = useTranslations("Social");
  const router = useRouter();
  const [following, setFollowing] = useState(initial);
  const [justFollowed, setJustFollowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const base = "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors";

  if (!signedIn) {
    return (
      <Link href={{ pathname: "/auth", query: next ? { next } : {} }} className={cn(base, "bg-brand text-brand-foreground hover:bg-brand/90", className)}>
        <PlusIcon className="size-4" aria-hidden="true" />
        {t("follow")}
      </Link>
    );
  }

  async function toggle() {
    const want = !following;
    setFollowing(want);
    setJustFollowed(want);
    if (want) haptic();
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, follow: want }),
      });
      if (!res.ok) {
        setFollowing(!want);
        setProblem(res.status === 429 ? "limited" : res.status === 404 ? "gone" : "error");
      } else {
        if (want) track("followed", { via });
        // The profile's follower count comes from the server.
        if (via === "profile") router.refresh();
      }
    } catch {
      setFollowing(!want);
      setProblem("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={cn(
          base,
          following
            ? "bg-card text-foreground ring-1 ring-border hover:bg-muted"
            : "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90",
        )}
      >
        {following ? <CheckIcon className={cn("size-4", justFollowed && "animate-pop")} aria-hidden="true" /> : <PlusIcon className="size-4" aria-hidden="true" />}
        {following ? t("following") : t("follow")}
      </button>
      <span aria-live="polite" className="text-xs text-destructive empty:hidden">
        {problem ? t("problem", { problem }) : ""}
      </span>
    </span>
  );
}
