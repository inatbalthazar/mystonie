import { useTranslations } from "next-intl";
import type { Official } from "@/core/official";
import { cn } from "@/lib/utils";

/**
 * The label next to an official account's name (ADR 0098): Stonie is the Mascot, the team's own accounts are Team. It
 * goes wherever their name shows, so nobody takes them for other members.
 */
export function OfficialLabel({ official, className }: { official: Official | null | undefined; className?: string }) {
  const t = useTranslations("Official");
  if (!official) return null;
  return (
    <span
      title={t(official === "mascot" ? "mascotHint" : "teamHint")}
      className={cn(
        "inline-flex shrink-0 -rotate-2 items-center rounded-[4px] border border-dashed px-1.5 py-px align-middle font-display text-[10px] leading-4 font-extrabold tracking-[0.08em] uppercase [&:lang(th)]:tracking-normal",
        official === "mascot" ? "border-brand/60 bg-brand-soft text-brand dark:bg-brand/15" : "border-foreground/40 bg-muted text-foreground",
        className,
      )}
    >
      {t(official)}
    </span>
  );
}
