import { useTranslations } from "next-intl";
import { boardPlace, type BoardRow } from "@/core/board";
import { Link } from "@/i18n/navigation";
import { BoardList } from "./board-list";

const TOP = 3;

/**
 * Home's peek at this week's board (S3 finishers & the board): where you stand, the top three (and you, when you're
 * further down), and a way to the full board. Only for someone who follows people.
 */
export function BoardNote({ rows }: { rows: BoardRow[] }) {
  const t = useTranslations("Board");
  const { rank, of } = boardPlace(rows);
  const top = rows.slice(0, TOP);
  const me = rows.find((r) => r.me);
  const shown = me && !top.includes(me) ? [...top, me] : top;

  return (
    <section aria-labelledby="board-note" className="relative flex rotate-[-0.4deg] flex-col gap-2 rounded-2xl bg-card p-4 pt-5 shadow-md ring-1 ring-border">
      <span aria-hidden="true" className="absolute -top-2.5 right-8 h-5 w-16 rotate-[4deg] rounded-[2px] bg-brand-soft/90 ring-1 ring-brand/10 dark:bg-brand/30" />
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="board-note" className="font-display text-xl font-extrabold">
          {t("homeTitle")}
        </h2>
        <Link href="/board" className="flex min-h-11 shrink-0 items-center text-sm font-semibold text-brand">
          {t("seeBoard")}
        </Link>
      </div>
      <p className="font-hand text-xl leading-tight">{rank !== null ? t("homePlace", { rank, count: of }) : t("homeUnranked", { count: of })}</p>
      <BoardList rows={shown} compact />
    </section>
  );
}
