import { useTranslations } from "next-intl";
import { CardFooter, CardRoot, CardTitle, Poster, Review, Stars, useFinishedDate, type TemplateProps } from "../parts";

/** Poster in a slightly tilted polaroid frame with a hand-written-style caption. Works for anything. */
export function PolaroidCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className="items-center p-[72px]">
      {/* Tape */}
      <span className="absolute top-[72px] left-1/2 z-10 h-[72px] w-[260px] -translate-x-1/2 rotate-[-3deg] bg-[var(--card-accent)] opacity-70" />

      <div
        className={
          "mt-[40px] flex w-[860px] shrink-0 rotate-[-2deg] flex-col gap-[28px] bg-[var(--card-paper)] p-[40px] text-[var(--card-ink)] shadow-[0_24px_60px_rgba(0,0,0,0.35)] " +
          (story ? "pb-[56px]" : "pb-[36px]")
        }
      >
        <Poster url={data.posterUrl} className={story ? "aspect-[2/3] w-full" : "h-[580px] w-full"} />
        <div className="flex items-end justify-between gap-[24px]">
          <p className="text-[36px] italic opacity-70">{t("finishedOn", { date })}</p>
          <Stars rating={data.rating} className="shrink-0 text-[48px]" />
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[24px] text-center">
        <CardTitle data={data} size={size} className={story ? "line-clamp-2" : "line-clamp-2 text-[52px]"} />
        <Review text={data.review} className={"text-[44px] italic leading-snug text-[var(--card-muted)] " + (story ? "" : "line-clamp-1")} />
      </div>

      <CardFooter host={host} className="shrink-0" />
    </CardRoot>
  );
}
