import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, Poster, footerUser, useHeadline, useRecapRange, useStats, type TemplateProps } from "../parts";

// Each pasted poster leans its own way, like prints stuck in by hand.
const TILTS = ["rotate-[-4deg]", "rotate-[3deg]", "rotate-[2deg]", "rotate-[-3deg]"];

/**
 * Weekly Recap as an album page (ADR 0025): the week stamped in the corner, the week's posters taped onto
 * ruled paper, then the numbers. Story lays 3–4 posters out 2 × 2; a feed post keeps them in one row.
 */
export function CollageCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const headline = useHeadline(data);
  const range = useRecapRange(data.recap);
  const stats = useStats(data);
  const titles = data.recap?.titles ?? [];
  const story = size === "story";
  const n = titles.length;
  const width = story ? (n <= 1 ? "w-[520px]" : n === 2 ? "w-[400px]" : "w-[340px]") : n <= 1 ? "w-[300px]" : n === 2 ? "w-[280px]" : "w-[200px]";

  return (
    <CardRoot size={size} palette={palette} className="bg-[var(--card-paper)] px-[80px] pt-[72px] pb-[64px] text-[var(--card-ink)]">
      {/* Ruled album paper with a coloured margin line. */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(to_bottom,transparent_0_78px,rgb(0_0_0/0.07)_78px_80px)]" />
      <div className="absolute inset-y-0 left-[44px] w-[4px] bg-[var(--card-accent)] opacity-50" />

      {/* The range goes under the stamp: across New Year it carries both years ("Dec 28, 2026 – Jan 3, 2027"). */}
      <header className="relative flex flex-col items-start gap-[20px]">
        <div className="rotate-[-5deg] rounded-[16px] border-[6px] border-[var(--card-stamp)] px-[28px] py-[10px] text-[var(--card-stamp)]">
          <p className={cn(DISPLAY, "text-[48px] leading-none font-extrabold tracking-[0.08em] whitespace-nowrap uppercase [&:lang(th)]:tracking-normal")}>
            {headline}
          </p>
        </div>
        <p data-fit="" className={cn("line-clamp-2 w-full px-[8px] [font-family:var(--card-hand)]", story ? "text-[88px]" : "text-[64px]", "leading-[1.1]")}>
          {range}
        </p>
      </header>

      <div className={cn("relative flex flex-1 flex-wrap content-center items-center justify-center", story ? "gap-x-[56px] gap-y-[48px]" : "gap-[36px]")}>
        {titles.map((title, i) => (
          <figure key={i} className={cn("relative shrink-0 bg-white p-[14px] shadow-[0_18px_40px_rgb(0_0_0/0.28)]", width, TILTS[i % TILTS.length])}>
            <span className="absolute -top-[22px] left-1/2 z-10 h-[48px] w-[150px] -translate-x-1/2 rotate-[-3deg] bg-[var(--card-accent)] opacity-70" />
            <div className="relative aspect-[2/3] w-full">
              <Poster url={title.posterUrl} className="absolute inset-0" />
              {!title.posterUrl && (
                <p
                  className={cn(
                    DISPLAY,
                    "absolute inset-0 line-clamp-5 font-extrabold text-white [overflow-wrap:anywhere]",
                    !story && n >= 3 ? "p-[12px] text-[24px]" : "p-[20px] text-[40px]",
                    "leading-[1.1]",
                  )}
                >
                  {title.name}
                </p>
              )}
            </div>
          </figure>
        ))}
      </div>

      {stats.length > 0 && (
        <dl className={cn("relative grid gap-[32px] border-t-[4px] border-[var(--card-ink)] pt-[32px]", stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", story ? "text-[150px]" : "text-[112px]", "leading-[0.9]")}>
                {s.value}
              </dd>
              <dt className="mt-[10px] truncate text-[28px] font-bold tracking-[0.12em] uppercase opacity-70 [&:lang(th)]:tracking-normal">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}
      {data.recap && (
        <p className="relative mt-[20px] truncate text-[32px] opacity-70">{t("titlesWatched", { count: data.recap.titleCount, period: data.recap.period ?? "week" })}</p>
      )}
      <CardFooter host={host} {...footerUser(data)} className="relative mt-[36px] shrink-0" />
    </CardRoot>
  );
}
