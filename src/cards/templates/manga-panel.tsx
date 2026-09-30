import { useTranslations } from "next-intl";
import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, FinisherStamp, footerUser, Poster, Review, Stars, useCardName, useFinishedDate, useHeadline, useStats, type TemplateProps } from "../parts";

/** A comic panel: thick ink border on paper. */
const PANEL = "relative overflow-hidden border-[8px] border-[var(--card-ink)] bg-[var(--card-paper)]";

// The title sits in a narrower panel than other templates, so it gets its own size steps.
const TITLE_SIZES = {
  story: ["text-[96px]", "text-[78px]", "text-[62px]", "text-[50px]"],
  feed: ["text-[72px]", "text-[60px]", "text-[50px]", "text-[42px]"],
} as const;

/**
 * A manga page (S2 books & manga): the cover in the big panel with a speech bubble shouting the headline, the title
 * on screentone, the numbers in a panel of focus lines. Black ink on paper, accented from the cover. For manga.
 */
export function MangaPanelCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const name = useCardName(data);
  const [big, small] = useStats(data);
  const story = size === "story";
  const bigSize = !big ? "" : big.value.length <= 3 ? (story ? "text-[150px]" : "text-[110px]") : big.value.length <= 5 ? (story ? "text-[112px]" : "text-[88px]") : story ? "text-[80px]" : "text-[64px]";

  return (
    <CardRoot size={size} palette={palette} className="gap-[24px] bg-[var(--card-paper)] p-[56px] text-[var(--card-ink)]">
      {/* The big panel: the cover, with a speech bubble breaking out over its border. */}
      <div className={cn("relative shrink-0", story ? "h-[860px]" : "h-[520px]")}>
        <div className={cn(PANEL, "size-full")}>
          <Poster url={data.posterUrl} className="size-full" />
        </div>
        <div className={cn("absolute top-[28px] left-[28px] max-w-[70%] -rotate-[4deg]", story ? "" : "top-[20px]")}>
          <p
            className={cn(
              DISPLAY,
              "truncate rounded-[50%] border-[6px] border-[var(--card-ink)] bg-[var(--card-paper)] font-extrabold tracking-[0.02em] uppercase shadow-[8px_8px_0_var(--card-ink)]",
              story ? "px-[64px] py-[40px] text-[68px]" : "px-[52px] py-[30px] text-[54px]",
              "leading-none",
            )}
          >
            {headline}
          </p>
          {/* The bubble's tail, pointing down at the cover. */}
          <span className="absolute -bottom-[34px] left-[30%] size-[56px] rotate-[35deg] skew-x-[20deg] border-r-[6px] border-b-[6px] border-[var(--card-ink)] bg-[var(--card-paper)]" />
        </div>
        <FinisherStamp
          data={data}
          className={cn("absolute right-[32px] bottom-[32px] rotate-[10deg]", !story && "origin-bottom-right scale-[0.8]")}
        />
      </div>

      <div className={cn("flex shrink-0 gap-[24px]", story ? "h-[440px]" : "h-[300px]")}>
        {/* Screentone (accent dots) behind a narration box and the title. */}
        <div className={cn(PANEL, "flex min-w-0 flex-[3] flex-col gap-[20px] p-[28px]")}>
          <span className="absolute inset-0 bg-[radial-gradient(var(--card-accent)_28%,transparent_31%)] bg-[length:22px_22px] opacity-40" />
          <p className="relative self-start border-[4px] border-[var(--card-ink)] bg-[var(--card-paper)] px-[18px] py-[6px] text-[28px] font-bold tracking-[0.18em] uppercase">
            {t("kind", { kind: data.kind })}
            {data.year ? ` · ${data.year}` : ""}
          </p>
          <h2
            data-fit=""
            className={cn(
              DISPLAY,
              "relative line-clamp-3 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] [text-shadow:4px_4px_0_var(--card-paper),-4px_-4px_0_var(--card-paper),4px_-4px_0_var(--card-paper),-4px_4px_0_var(--card-paper)]",
              TITLE_SIZES[size][titleSizeStep(name)],
              "leading-[1.05]",
            )}
          >
            {name}
          </h2>
        </div>

        {/* Focus lines around the number. */}
        <div className={cn(PANEL, "flex min-w-0 flex-[2] flex-col items-center justify-center gap-[16px] p-[24px] text-center")}>
          <span className="absolute inset-[-50%] bg-[repeating-conic-gradient(var(--card-ink)_0deg_2deg,transparent_2deg_9deg)] opacity-25" />
          <span className="absolute inset-[18%] rounded-full bg-[var(--card-paper)] blur-[18px]" />
          {big ? (
            <dl className="relative flex flex-col items-center gap-[12px]">
              <div className="flex flex-col items-center">
                <dd data-fit="" className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", bigSize, "leading-[0.95]")}>
                  {big.value}
                </dd>
                <dt className="mt-[6px] text-[28px] font-bold tracking-[0.15em] uppercase">{big.label}</dt>
              </div>
              {small && (
                <div className="flex items-baseline gap-[10px]">
                  <dd className={cn(DISPLAY, "font-extrabold whitespace-nowrap", story ? "text-[52px]" : "text-[40px]", "leading-none")}>{small.value}</dd>
                  <dt className="text-[24px] font-bold tracking-[0.12em] uppercase">{small.label}</dt>
                </div>
              )}
            </dl>
          ) : (
            <p className="relative text-[56px] leading-tight [font-family:var(--card-hand)]">{date}</p>
          )}
        </div>
      </div>

      {/* The last panel: the date, the rating and the one-line review; speed lines when there's no review. */}
      <div className={cn(PANEL, "flex min-h-0 flex-1 flex-col justify-center gap-[16px] px-[36px] py-[24px]")}>
        {!data.review && <span className="absolute inset-0 bg-[repeating-linear-gradient(0deg,var(--card-ink)_0_3px,transparent_3px_30px)] opacity-15" />}
        <div className="relative flex items-center justify-between gap-[24px]">
          <p
            className={cn(
              "truncate leading-tight [font-family:var(--card-hand)]",
              data.review ? "text-[52px]" : "bg-[var(--card-paper)] px-[16px] text-[72px]",
            )}
          >
            {date}
          </p>
          <Stars rating={data.rating} className="shrink-0 text-[48px] text-[var(--card-stamp)]" />
        </div>
        <Review text={data.review} className={cn("relative text-[40px] leading-snug", story ? "line-clamp-2" : "line-clamp-1")} />
      </div>

      <CardFooter host={host} username={footerUser(data)} className="shrink-0" />
    </CardRoot>
  );
}
