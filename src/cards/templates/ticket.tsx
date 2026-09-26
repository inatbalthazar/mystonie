import { useTranslations } from "next-intl";
import { CardFooter, CardRoot, CardTitle, Poster, Review, Stars, useFinishedDate, useStats, type TemplateProps } from "../parts";

/** Cinema ticket stub: poster on top, perforation, stats where seat/row would be. Best for movies. */
export function TicketCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const stats = useStats(data).slice(0, 2);
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className="items-center justify-center p-[64px]">
      <div className="flex w-full flex-1 flex-col overflow-hidden rounded-[40px] bg-[var(--card-paper)] text-[var(--card-ink)]">
        <Poster url={data.posterUrl} className={story ? "h-[860px] shrink-0" : "h-[360px] shrink-0"} />

        {/* Perforation: two notches + dashed tear line. */}
        <div className="relative h-[64px] shrink-0">
          <span className="absolute top-1/2 -left-[32px] size-[64px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <span className="absolute top-1/2 -right-[32px] size-[64px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <span className="absolute top-1/2 right-[48px] left-[48px] border-t-[6px] border-dashed border-[var(--card-ink)] opacity-25" />
        </div>

        <div className={"flex min-h-0 flex-1 flex-col px-[64px] " + (story ? "gap-[28px] pb-[56px]" : "gap-[20px] pb-[40px]")}>
          <div className="flex items-center justify-between text-[30px] font-semibold tracking-[0.2em] uppercase opacity-60">
            <span>{t("admitOne")}</span>
            <span>{t("kind", { kind: data.kind })}{data.year ? ` · ${data.year}` : ""}</span>
          </div>
          <CardTitle data={data} size={size} className={story ? "" : "line-clamp-2"} />
          <Stars rating={data.rating} className="text-[64px] text-[var(--card-ink)]" />
          <Review text={data.review} className={"text-[40px] leading-snug opacity-80 " + (story ? "" : "line-clamp-1")} />

          <dl className="mt-auto grid grid-cols-3 gap-[24px] border-t-[4px] border-[var(--card-ink)]/15 pt-[28px]">
            <div className="min-w-0">
              <dt className="text-[26px] tracking-[0.15em] uppercase opacity-60">{t("finished")}</dt>
              <dd className="text-[38px] font-bold whitespace-nowrap">{date}</dd>
            </div>
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="truncate text-[26px] tracking-[0.15em] uppercase opacity-60">{s.label}</dt>
                <dd className="text-[38px] font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <CardFooter host={host} className="mt-[40px] shrink-0" />
    </CardRoot>
  );
}
