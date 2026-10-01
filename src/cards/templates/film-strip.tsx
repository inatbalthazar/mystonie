import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, CardTitle, FinisherStamp, footerUser, Poster, Review, Stars, useFinishedDate, useHeadline, type TemplateProps } from "../parts";

// Film stock's edge print: amber on black, whatever the poster's colours.
const FILM = "#141210";
const EDGE = "#e8a33d";

/** A column of sprocket holes down one edge of the strip. */
function Sprockets({ count }: { count: number }) {
  return (
    <div className="flex flex-col justify-between py-[20px]">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-[30px] w-[40px] rounded-[7px] bg-[var(--card-bg)]" />
      ))}
    </div>
  );
}

/**
 * Pro (S2 Pro, ADR 0034): a strip of 35 mm film taped into the album. The poster is the middle frame, with the
 * frames before and after it running off the strip, amber edge print, and a paper label with the title, the
 * stars and the date in handwriting. Movies and series, Finish and Progress.
 */
export function FilmStripCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const story = size === "story";
  const progress = data.progress;
  const width = story ? "w-[480px]" : "w-[340px]";

  return (
    <CardRoot size={size} palette={palette} className="items-center p-[64px]">
      <div className="relative flex min-h-0 w-full flex-1 items-end justify-center">
        {/* The strip: tilted, running off the card's top like a length cut from a roll; its foot goes under the label. */}
        <div className="relative -mt-[170px] flex h-[calc(100%+170px)] rotate-[-4deg] gap-[18px] overflow-hidden px-[18px] shadow-[0_30px_80px_rgba(0,0,0,0.45)]" style={{ background: FILM }}>
          <Sprockets count={story ? 24 : 16} />
          {/* The frames before and after take what's left of the strip, so nothing spills past its edges. */}
          <div className="flex h-full flex-col items-center gap-[26px]">
            <Poster url={data.posterUrl} className={cn(width, "min-h-0 flex-1 opacity-45")} />
            <div className="relative shrink-0">
              <Poster url={data.posterUrl} className={cn(width, story ? "h-[720px]" : "h-[510px]")} />
              <span className="absolute -bottom-[26px] left-0 text-[20px] font-bold tracking-[0.25em]" style={{ color: EDGE }}>
                {t("filmFrame")}
              </span>
            </div>
            <Poster url={data.posterUrl} className={cn(width, "min-h-0 flex-1 opacity-45")} />
          </div>
          <Sprockets count={story ? 24 : 16} />
          <span
            className="absolute top-[240px] left-[4px] text-[22px] font-bold tracking-[0.3em] whitespace-nowrap uppercase [writing-mode:vertical-rl]"
            style={{ color: EDGE }}
          >
            {t("filmEdge")}
          </span>
        </div>

        {/* Tape holding the strip down. */}
        <span className="absolute top-[40px] left-[250px] z-10 h-[60px] w-[210px] rotate-[-18deg] bg-[var(--card-accent)] opacity-75" />
      </div>

      {/* The paper label, pasted over the strip's foot. */}
      <div
        className={cn(
          "relative z-10 -mt-[120px] flex w-[900px] shrink-0 rotate-[1.5deg] flex-col gap-[14px] bg-[var(--card-paper)] px-[52px] text-[var(--card-ink)] shadow-[0_18px_40px_rgba(0,0,0,0.3)]",
          story ? "py-[44px]" : "py-[32px]",
        )}
      >
        <span className="absolute -top-[26px] right-[80px] h-[52px] w-[180px] rotate-[6deg] bg-[var(--card-accent)] opacity-60" />
        <FinisherStamp
          data={data}
          className={cn("absolute -right-[24px] rotate-[10deg]", story ? "-top-[250px]" : "-top-[190px] origin-bottom-right scale-[0.75]")}
        />
        <p className="text-[26px] font-semibold tracking-[0.2em] uppercase opacity-60">
          {t("kind", { kind: data.kind })}
          {data.year ? ` · ${data.year}` : ""}
        </p>
        {progress && (
          <p className="flex items-baseline gap-[18px] text-[var(--card-stamp)]">
            <span className="truncate text-[56px] leading-[1.1] [font-family:var(--card-hand)]">{headline}</span>
            {!data.hide?.includes("episodes") && (
              <span className="shrink-0 text-[34px] font-bold tracking-[0.08em] whitespace-nowrap uppercase">
                {t("progressCount", { watched: format.number(progress.watched), total: format.number(progress.total) })}
              </span>
            )}
          </p>
        )}
        <CardTitle data={data} size={size} className={cn("text-[var(--card-ink)]", story ? "line-clamp-2" : "line-clamp-1 text-[56px]")} />
        <div className="flex items-center justify-between gap-[24px]">
          <p className="text-[48px] leading-none whitespace-nowrap [font-family:var(--card-hand)]">{date}</p>
          <Stars rating={data.rating} className="shrink-0 text-[46px] text-[var(--card-stamp)]" />
        </div>
        {story && <Review text={data.review} className="line-clamp-2 px-[4px] text-[44px]/[1.15] opacity-80 [font-family:var(--card-hand)]" />}
      </div>

      <CardFooter host={host} {...footerUser(data)} className={cn("w-full shrink-0", story ? "mt-[48px]" : "mt-[32px]")} />
    </CardRoot>
  );
}
