"use client";

import { ChevronDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Long grids show their first two rows and this button (mobile checklist, ADR 0050). Grids hide the rest with
 * `previewClass` per item; `hiddenFromSm` hides the button from 640px when the wider grid's two rows hold everything.
 */
export function ShowAll({ open, onToggle, count, hiddenFromSm = false }: { open: boolean; onToggle: () => void; count: number; hiddenFromSm?: boolean }) {
  const t = useTranslations("Nav");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        "mx-auto flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        hiddenFromSm && "sm:hidden",
      )}
    >
      {open ? t("showLess") : t("showAll", { count })}
      <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
    </button>
  );
}

/** Classes that hide item `index` while collapsed: past `phone` items on phones, past `wide` from 640px. */
export function previewClass(index: number, open: boolean, phone: number, wide: number): string | undefined {
  if (open) return undefined;
  if (index >= wide) return "hidden";
  if (index >= phone) return "hidden sm:block";
  return undefined;
}
