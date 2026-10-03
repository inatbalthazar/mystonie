"use client";

import { EyeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

/**
 * A writer's article marked "It has spoilers" (ADR 0092): a warning in its place until the reader chooses to read it.
 * The text is in the page either way (search engines read it), blurred and hidden from screen readers until then.
 */
export function SpoilerGate({ children }: { children: ReactNode }) {
  const t = useTranslations("Journal");
  const [shown, setShown] = useState(false);
  if (shown) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden="true" className="pointer-events-none max-h-56 overflow-hidden blur-md select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/70 px-6 text-center">
        <p className="font-hand text-2xl leading-tight">{t("spoilerWarning")}</p>
        <button
          type="button"
          onClick={() => setShown(true)}
          className="flex h-11 items-center gap-2 rounded-full bg-brand px-5 font-bold text-brand-foreground shadow-sm hover:bg-brand/90 press"
        >
          <EyeIcon className="size-5" aria-hidden="true" />
          {t("showSpoilers")}
        </button>
      </div>
    </div>
  );
}
