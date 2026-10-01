"use client";

import { MessageSquareWarningIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FeedbackKind } from "@/core/feedback";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * "Report a problem" (ADR 0055): a link to /feedback that says which page it came from, so a report can say where
 * it happened. The footer shows a text link, Settings and the error pages a button.
 */
export function FeedbackLink({
  place,
  kind,
  errorRef,
  className,
}: {
  place: "footer" | "button";
  kind?: FeedbackKind;
  errorRef?: string;
  className?: string;
}) {
  const t = useTranslations("Beta");
  const path = usePathname();
  const query = {
    ...(path !== "/feedback" ? { from: path } : {}),
    ...(kind ? { kind } : {}),
    ...(errorRef ? { ref: errorRef } : {}),
  };
  return (
    <Link
      href={{ pathname: "/feedback", query }}
      className={cn(
        place === "footer"
          ? "font-medium text-foreground underline underline-offset-4 hover:text-brand"
          : "inline-flex h-11 items-center gap-2 self-start rounded-xl px-5 font-semibold ring-1 ring-border hover:bg-muted",
        className,
      )}
    >
      {place === "button" && <MessageSquareWarningIcon className="size-4" aria-hidden="true" />}
      {t("report")}
    </Link>
  );
}
