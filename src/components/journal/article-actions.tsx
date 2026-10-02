"use client";

import { BookmarkIcon, Share2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import type { ArticlePlace } from "@/core/analytics";
import { localizedPath } from "@/core/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { track } from "@/lib/analytics";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

const button = "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95";

/**
 * Save for later (ADR 0052): a bookmark on a Journal article; saved ones are on the Journal's Saved tab and on Me.
 * Optimistic, like the Stamp. `signInNext` makes it a link to sign in (and come back) for visitors.
 */
export function SaveButton({
  slug,
  saved: initial,
  place,
  compact = false,
  signInNext,
}: {
  slug: string;
  saved: boolean;
  place: ArticlePlace;
  /** The icon only, for rows. */
  compact?: boolean;
  signInNext?: string;
}) {
  const t = useTranslations("Journal");
  const ts = useTranslations("Social");
  const [saved, setSaved] = useState(initial);
  const [justSaved, setJustSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(false);
  const look = cn(button, compact ? "rounded-full" : "px-3 ring-1 ring-border", saved ? "text-brand" : "text-muted-foreground hover:bg-muted hover:text-foreground");

  if (signInNext !== undefined) {
    return (
      <Link href={{ pathname: "/auth", query: { next: signInNext } }} aria-label={t("save")} className={look}>
        <BookmarkIcon className="size-5" aria-hidden="true" />
        {!compact && t("save")}
      </Link>
    );
  }

  async function toggle() {
    const want = !saved;
    setSaved(want);
    setJustSaved(want);
    if (want) haptic();
    setBusy(true);
    setProblem(false);
    try {
      const res = await fetch("/api/journal/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind: "save", on: want }),
      });
      if (!res.ok) throw new Error(String(res.status));
      if (want) track("article_saved", { place });
    } catch {
      setSaved(!want);
      setJustSaved(false);
      setProblem(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} aria-label={saved ? t("unsave") : t("save")} className={look}>
        <BookmarkIcon className={cn("size-5", saved && "fill-current", justSaved && "animate-pop")} aria-hidden="true" />
        {!compact && (saved ? t("saved") : t("save"))}
      </button>
      <Bubble tone="problem">{problem ? ts("problem", { problem: "error" }) : ""}</Bubble>
    </span>
  );
}

/** Share an article: the phone's share sheet, else its link copied ("Link copied"). Anyone can share. */
export function ShareButton({ slug, title, place, compact = false }: { slug: string; title: string; place: ArticlePlace; compact?: boolean }) {
  const t = useTranslations("Journal");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(localizedPath(`/journal/${slug}`, locale, routing.defaultLocale), window.location.origin);
    url.searchParams.set("ref", "journal");
    try {
      if (navigator.share) {
        await navigator.share({ title, url: url.href });
        track("article_shared", { place, channel: "share_sheet" });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      track("article_shared", { place, channel: "copy" });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No share sheet and no clipboard: nothing more to try.
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={share}
        aria-label={t("share")}
        className={cn(button, compact ? "rounded-full" : "px-3 ring-1 ring-border", "text-muted-foreground hover:bg-muted hover:text-foreground")}
      >
        <Share2Icon className="size-5" aria-hidden="true" />
        {!compact && t("share")}
      </button>
      <Bubble tone="note">{copied ? t("copied") : ""}</Bubble>
    </span>
  );
}

/** A short note above a button ("Link copied", a problem), read out by screen readers, never moving the row. */
function Bubble({ tone, children }: { tone: "note" | "problem"; children: string }) {
  return (
    <span
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute right-0 bottom-full z-20 mb-1 w-max max-w-56 rounded-lg px-2.5 py-1 text-xs font-semibold shadow-md empty:hidden",
        tone === "note" ? "bg-foreground text-background" : "bg-card text-destructive ring-1 ring-destructive/40",
      )}
    >
      {children}
    </span>
  );
}
