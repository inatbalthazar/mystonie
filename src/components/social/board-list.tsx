import { useFormatter, useTranslations } from "next-intl";
import type { BoardRow } from "@/core/board";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

// The top three get a little medal sticker: gold, silver, bronze (fixed colours, dark ink on each).
const MEDALS = ["bg-[#f5c04a] text-[#3b2a00]", "bg-[#cfd6de] text-[#1f2933]", "bg-[#e0a070] text-[#3a1d08]"];

/** "45 min" under an hour, else hours with one decimal ("12.5 h"). */
export function useBoardTime(): (minutes: number) => string {
  const t = useTranslations("Board");
  const format = useFormatter();
  return (minutes) =>
    minutes < 60 ? t("minutes", { count: format.number(minutes) }) : t("hours", { count: format.number(Math.round(minutes / 6) / 10, { maximumFractionDigits: 1 }) });
}

/**
 * The board's lines (S3 finishers & the board): place, who, time and what they finished. The viewer's own line is
 * highlighted; with nothing yet it has no place. `compact` (Home) shows fewer details.
 */
export function BoardList({ rows, compact = false }: { rows: BoardRow[]; compact?: boolean }) {
  const t = useTranslations("Board");
  const format = useFormatter();
  const time = useBoardTime();

  return (
    <ol className="stagger flex flex-col">
      {rows.map((row) => {
        const name = row.me ? t("you") : row.displayName || row.username;
        const medal = row.rank !== null && row.rank <= 3 ? MEDALS[row.rank - 1] : null;
        return (
          <li
            key={row.id}
            aria-current={row.me ? "true" : undefined}
            className={cn(
              "flex items-center gap-3 border-b border-dashed border-border py-2.5 last:border-b-0",
              row.me && "-mx-2 rounded-xl border-transparent bg-brand-soft/70 px-2 dark:bg-brand/15",
            )}
          >
            <span className="flex w-9 shrink-0 justify-center">
              {row.rank === null ? (
                <span className="font-display text-xl font-extrabold text-muted-foreground" aria-label={t("unranked")}>
                  {t("noRank")}
                </span>
              ) : medal ? (
                <span className={cn("flex size-9 -rotate-6 items-center justify-center rounded-full font-display text-lg font-extrabold shadow-sm ring-2 ring-white/80 dark:ring-white/20", medal)}>
                  <span className="sr-only">{t("place", { rank: row.rank })}</span>
                  <span aria-hidden="true">{row.rank}</span>
                </span>
              ) : (
                <span className="font-display text-xl font-extrabold tabular-nums">
                  <span className="sr-only">{t("place", { rank: row.rank })}</span>
                  <span aria-hidden="true">{row.rank}</span>
                </span>
              )}
            </span>
            <Link href={`/u/${row.username}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg hover:opacity-90">
              <Avatar name={row.displayName || row.username} url={row.avatarUrl} className={compact ? "size-8" : "size-10"} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{name}</span>
                {!compact && (
                  <span className="truncate text-xs text-muted-foreground">
                    {row.rank === null ? t("unranked") : t("details", { finished: row.finished, episodes: row.episodes })}
                  </span>
                )}
              </span>
            </Link>
            <span className="shrink-0 text-right font-display text-lg font-extrabold tabular-nums">
              {row.minutes > 0 ? time(row.minutes) : row.finished > 0 ? t("finishedOnly", { count: format.number(row.finished) }) : t("nothing")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
