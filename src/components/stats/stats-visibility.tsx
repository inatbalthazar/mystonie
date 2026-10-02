"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, use, useState, type ReactNode } from "react";
import { saveAccount } from "@/components/settings/save-account";
import type { StatsSection } from "@/core/album";
import { cn } from "@/lib/utils";

type Visibility = { hidden: readonly StatsSection[]; toggle: (section: StatsSection) => void };
const VisibilityContext = createContext<Visibility | null>(null);

/**
 * Which parts of Me's Stats visitors see on the profile (ADR 0077): holds the hidden ones for the eyes inside
 * (`StatsPart`) and saves each tap at once (`statsHidden`, PATCH /api/account), putting it back if that fails.
 */
export function StatsVisibility({ hidden: saved, children }: { hidden: StatsSection[]; children: ReactNode }) {
  const t = useTranslations("Stats");
  const [hidden, setHidden] = useState(saved);
  const [failed, setFailed] = useState(false);

  async function toggle(section: StatsSection) {
    const before = hidden;
    const next = hidden.includes(section) ? hidden.filter((s) => s !== section) : [...hidden, section];
    setHidden(next);
    setFailed(false);
    const result = await saveAccount({ statsHidden: next });
    if (!result.ok) {
      setHidden(before);
      setFailed(true);
      setTimeout(() => setFailed(false), 4000);
    }
  }

  return (
    <VisibilityContext value={{ hidden, toggle }}>
      {children}
      <p role="status" className={cn("fixed inset-x-4 bottom-[calc(var(--island-space,0px)+1rem)] z-40 mx-auto max-w-sm rounded-2xl bg-foreground px-4 py-3 text-center text-sm font-semibold text-background shadow-lg", !failed && "sr-only")}>
        {failed ? t("visibilityFailed") : ""}
      </p>
    </VisibilityContext>
  );
}

/** One part of Me's Stats with its eye in the top corner; hidden from visitors, it says "Only you". */
export function StatsPart({ section, children }: { section: StatsSection; children: ReactNode }) {
  const t = useTranslations("Stats");
  const visibility = use(VisibilityContext);
  if (!visibility) return children;
  const hidden = visibility.hidden.includes(section);
  const name = t("section", { section });
  return (
    <div data-stats-part={section} className="relative">
      {children}
      <button
        type="button"
        onClick={() => visibility.toggle(section)}
        aria-pressed={hidden}
        aria-label={hidden ? t("showSection", { section: name }) : t("hideSection", { section: name })}
        className={cn(
          "absolute top-1 right-1 z-10 flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors press",
          hidden ? "bg-muted text-foreground ring-1 ring-border" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        {hidden ? <EyeOffIcon className="size-4" aria-hidden="true" /> : <EyeIcon className="size-4" aria-hidden="true" />}
        {hidden && <span aria-hidden="true">{t("onlyYou")}</span>}
      </button>
    </div>
  );
}
