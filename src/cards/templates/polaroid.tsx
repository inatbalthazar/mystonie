import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, footerUser, CardTitle, FinisherStamp, Poster, Review, Stars, useFinishedDate, useHeadline, type TemplateProps } from "../parts";

/** Poster in a tilted polaroid frame with tape and a hand-written caption. Works for anything. */
export function PolaroidCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const progress = data.progress;
  const reading = data.reading;
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className="items-center p-[72px]">
      {/* Tape strips on two corners. */}
      <span className="absolute top-[88px] left-[150px] z-10 h-[64px] w-[220px] rotate-[-14deg] bg-[var(--card-accent)] opacity-75" />
      <span className="absolute top-[70px] right-[140px] z-10 h-[64px] w-[200px] rotate-[10deg] bg-[var(--card-paper)] opacity-60" />

      <div
        className={cn(
          "relative mt-[48px] flex shrink-0 rotate-[-2deg] flex-col gap-[20px] bg-[var(--card-paper)] p-[40px] text-[var(--card-ink)] shadow-[0_28px_70px_rgba(0,0,0,0.4)]",
          story ? "w-[800px] pb-[44px]" : "w-[860px] pb-[28px]",
        )}
      >
        <Poster url={data.posterUrl} className={story ? "aspect-[2/3] w-full" : "h-[580px] w-full"} />
        <FinisherStamp
          data={data}
          className={cn("absolute rotate-[-12deg]", story ? "bottom-[150px] -left-[36px]" : "bottom-[96px] -left-[30px] origin-bottom-left scale-[0.8]")}
        />
        <div className="flex items-center justify-between gap-[24px]">
          <p className="text-[52px] leading-none whitespace-nowrap [font-family:var(--card-hand)]">{date}</p>
          <Stars rating={data.rating} className="shrink-0 text-[48px] text-[var(--card-stamp)]" />
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[16px] text-center">
        {reading && (
          // Reading Progress card: the milestone (or where the reader is) in handwriting, then how far along.
          <p className="flex max-w-full items-baseline gap-[20px] px-[12px] text-[var(--card-accent)]">
            <span className={cn("truncate [font-family:var(--card-hand)]", story ? "text-[72px]" : "text-[56px]", "leading-[1.1]")}>{headline}</span>
            {!data.hide?.includes("episodes") && reading.total && (
              <span className="shrink-0 text-[40px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">
                {t("readingCount", { unit: reading.unit, position: format.number(reading.position), total: format.number(reading.total) })}
              </span>
            )}
          </p>
        )}
        {progress && (
          // Progress card: the milestone (or episode) in handwriting, then how far along.
          <p className="flex max-w-full items-baseline gap-[20px] px-[12px] text-[var(--card-accent)]">
            <span className={cn("truncate [font-family:var(--card-hand)]", story ? "text-[72px]" : "text-[56px]", "leading-[1.1]")}>{headline}</span>
            {!data.hide?.includes("episodes") && (
              <span className="shrink-0 text-[40px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">
                {t("progressCount", { watched: format.number(progress.watched), total: format.number(progress.total) })}
              </span>
            )}
          </p>
        )}
        <CardTitle data={data} size={size} className={cn("px-[12px]", story ? "line-clamp-2" : "line-clamp-2 text-[52px]")} />
        <Review
          text={data.review}
          className={cn(
            // Side padding keeps script glyph overhang inside the box (clamped text must not scroll).
            "px-[12px] text-[var(--card-muted)] [font-family:var(--card-hand)]",
            story ? "line-clamp-2 text-[54px]/[1.15]" : "line-clamp-2 text-[44px]/[1.1]",
          )}
        />
      </div>

      <CardFooter host={host} username={footerUser(data)} className="w-full shrink-0" />
    </CardRoot>
  );
}
