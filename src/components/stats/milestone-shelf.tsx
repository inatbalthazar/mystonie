"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { Celebration } from "@/components/celebration";
import { PaperCard } from "@/components/paper-card";
import type { CardData } from "@/core/cards/types";
import { previewClass, ShowAll } from "@/components/show-all";
import { cn } from "@/lib/utils";

const TILTS = ["-rotate-2", "rotate-1", "rotate-2", "-rotate-1"];

/**
 * Milestones reached so far (ADR 0031), newest first, as little carved stones on the stats page. Tapping one opens
 * its Milestone card, so a milestone reached before the feature existed can still be shared. Two rows, then "Show all".
 */
export function MilestoneShelf({ milestones, username, host }: { milestones: CardData[]; username: string | null; host: string }) {
  const t = useTranslations("Stats");
  const tc = useTranslations("Card");
  const format = useFormatter();
  const [open, setOpen] = useState<CardData | null>(null);
  const [all, setAll] = useState(false);

  return (
    <PaperCard className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">{t("milestones")}</h2>
      {milestones.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("milestonesEmpty")}</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("milestonesHint")}</p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {milestones.map((m, i) => {
              const { metric, value } = m.milestone!;
              const date = format.dateTime(new Date(`${m.finishedOn}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });
              return (
                <li key={`${metric}-${value}`} className={previewClass(i, all, 4, 6)}>
                  <button
                    type="button"
                    onClick={() => setOpen(m)}
                    className={cn(
                      // A small stone: rounded top like a milestone, always stone-grey with dark carving.
                      "flex min-h-11 w-full flex-col items-center gap-0.5 rounded-t-[50%_40%] rounded-b-xl bg-[linear-gradient(160deg,#cdc7bd,#a39c91)] px-3 pt-4 pb-3 text-center text-[#2f2a26] shadow-md transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      TILTS[i % TILTS.length],
                    )}
                  >
                    <span className="font-display text-3xl leading-none font-extrabold tabular-nums">{format.number(value)}</span>
                    <span className="text-[11px] leading-tight font-bold tracking-wide uppercase [&:lang(th)]:tracking-normal">{tc("milestoneLabel", { metric })}</span>
                    <span className="mt-1 line-clamp-2 text-xs leading-tight [overflow-wrap:anywhere]">{t("milestoneOn", { date, name: m.name })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {milestones.length > 4 && <ShowAll open={all} onToggle={() => setAll(!all)} count={milestones.length} hiddenFromSm={milestones.length <= 6} />}
        </>
      )}
      {open && <Celebration data={open} source={{ kind: "milestone", ready: true }} username={username} host={host} onClose={() => setOpen(null)} />}
    </PaperCard>
  );
}
