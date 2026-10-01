"use client";

import { CoffeeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { track } from "@/lib/analytics";
import { SUPPORT_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

// A tip for the maker (ADR 0049): a plain link to Buy Me a Coffee, never a gate. The footer shows a small text link,
// Settings a button.
export function SupportLink({ place }: { place: "footer" | "settings" }) {
  const t = useTranslations("Support");
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("support_clicked", { place })}
      className={cn(
        "inline-flex items-center gap-1.5",
        place === "footer"
          ? "text-sm text-muted-foreground underline-offset-4 hover:underline"
          : "mt-4 h-11 self-start rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted",
      )}
    >
      <CoffeeIcon className="size-4" aria-hidden="true" />
      {place === "footer" ? t("footer") : t("link")}
      <span className="sr-only">{t("newTab")}</span>
    </a>
  );
}
