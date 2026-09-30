import { useFormatter, useTranslations } from "next-intl";
import type { ChallengeSlug } from "@/core/challenges";
import { cn } from "@/lib/utils";
import { ChallengePatch } from "./patch";

const TILTS = ["rotate-[-6deg]", "rotate-[4deg]", "rotate-[-2deg]", "rotate-[7deg]", "rotate-[-4deg]"];

/**
 * Completed challenges as patches sewn onto the album page, newest first, each with its name and month
 * (S3 challenges & clubs). `compact` for profiles.
 */
export function Patches({ patches, compact = false }: { patches: { slug: ChallengeSlug; month: string }[]; compact?: boolean }) {
  const t = useTranslations("Challenges");
  const format = useFormatter();
  return (
    <ul className={cn("grid gap-x-2 gap-y-4", compact ? "grid-cols-4 sm:grid-cols-6" : "grid-cols-3 sm:grid-cols-4")}>
      {patches.map((p, i) => {
        const month = format.dateTime(new Date(`${p.month}-01T00:00:00Z`), { month: "short", year: "numeric", timeZone: "UTC" });
        return (
          <li key={`${p.month}-${p.slug}`} className="flex flex-col items-center gap-1.5 text-center">
            <ChallengePatch slug={p.slug} size={compact ? 52 : 72} className={TILTS[i % TILTS.length]} />
            <span className={cn("leading-tight font-bold [overflow-wrap:anywhere]", compact ? "text-[11px]" : "text-xs")}>{t(`items.${p.slug}.name`)}</span>
            <span className="text-[11px] leading-none text-muted-foreground">{month}</span>
          </li>
        );
      })}
    </ul>
  );
}
