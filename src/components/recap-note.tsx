import { getFormatter, getTranslations } from "next-intl/server";
import { recapFigures } from "@/core/stats/recap";
import type { UserRecap } from "@/data/recaps";
import { Link } from "@/i18n/navigation";

/**
 * "Your week is in": a note taped into the collection for a week after a recap is made (ADR 0025), so the
 * recap card is one tap away even without the email.
 */
export async function RecapNote({ recap: { id, recap } }: { recap: UserRecap }) {
  const [t, tc, format] = await Promise.all([getTranslations("Recap"), getTranslations("Card"), getFormatter()]);
  const date = (key: string) => new Date(`${key}T00:00:00Z`);
  const range = format.dateTimeRange(date(recap.from), date(recap.to), { month: "short", day: "numeric", timeZone: "UTC" });
  const summary = recapFigures(recap)
    .map(({ key, value }) => {
      const label = key === "finished" ? tc("titlesFinished", { count: value }) : key === "episodes" ? tc("episodes", { count: value }) : tc(key);
      return `${format.number(value)} ${label}`;
    })
    .join(" · ");

  return (
    <aside className="relative mt-4 mb-2 rotate-[-0.6deg] rounded-2xl border-2 border-dashed border-brand/40 bg-brand-soft/60 p-4 pt-5 dark:bg-brand/15">
      <span aria-hidden="true" className="absolute -top-3 left-8 h-6 w-20 rotate-[-4deg] rounded-[2px] bg-card/90 shadow-sm ring-1 ring-border" />
      <p className="font-hand text-2xl leading-tight">{t("noteTitle", { range })}</p>
      <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
      <Link
        href={`/recap/${id}`}
        className="mt-3 inline-flex h-11 items-center rounded-xl bg-brand px-4 font-semibold text-brand-foreground shadow-sm hover:bg-brand/90"
      >
        {t("noteCta")}
      </Link>
    </aside>
  );
}
