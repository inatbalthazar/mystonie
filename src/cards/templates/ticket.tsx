import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, footerUser, CardTitle, DISPLAY, FinishedStamp, Poster, Review, Stars, useFinishedDate, useStats, type TemplateProps } from "../parts";

/** Cinema ticket stub: poster on top, perforation with a FINISHED stamp, stats where seat/row would be. Best for movies. */
export function TicketCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const stats = useStats(data).slice(0, 3);
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className="items-center justify-center p-[64px]">
      <div className="relative flex w-full flex-1 flex-col overflow-hidden rounded-[40px] bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <Poster url={data.posterUrl} className={story ? "h-[840px] shrink-0" : "h-[340px] shrink-0"} />

        {/* Perforation: two notches + dashed tear line, with the stamp sitting across it. */}
        <div className="relative h-[64px] shrink-0">
          <span className="absolute top-1/2 -left-[32px] size-[64px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <span className="absolute top-1/2 -right-[32px] size-[64px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <span className="absolute top-1/2 right-[48px] left-[48px] border-t-[6px] border-dashed border-[var(--card-ink)] opacity-25" />
          <FinishedStamp
            date={date}
            className={cn("absolute right-[56px] rotate-[-8deg] bg-[var(--card-paper)]", story ? "-top-[118px]" : "-top-[112px] origin-right scale-[0.85]")}
          />
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col px-[64px]", story ? "gap-[28px] pb-[56px]" : "gap-[18px] pb-[40px]")}>
          <div className="flex items-center justify-between text-[28px] font-semibold tracking-[0.2em] uppercase opacity-60">
            <span>{t("admitOne")}</span>
            <span>
              {t("kind", { kind: data.kind })}
              {data.year ? ` · ${data.year}` : ""}
            </span>
          </div>
          <CardTitle data={data} size={size} className={story ? "" : "line-clamp-2"} />
          <Stars rating={data.rating} className="text-[60px] text-[var(--card-stamp)]" />
          <Review text={data.review} className={cn("text-[40px] leading-snug opacity-80", story ? "" : "line-clamp-1")} />

          {stats.length > 0 && (
            <dl className="mt-auto grid grid-cols-3 gap-[24px] border-t-[4px] border-[var(--card-ink)]/15 pt-[24px]">
              {stats.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dt className="truncate text-[24px] tracking-[0.15em] uppercase opacity-60">{s.label}</dt>
                  <dd className={cn(DISPLAY, "text-[56px] leading-tight font-extrabold")}>{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
      <CardFooter host={host} username={footerUser(data)} className="mt-[40px] w-full shrink-0" />
    </CardRoot>
  );
}
