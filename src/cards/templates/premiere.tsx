import { useTranslations } from "next-intl";
import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { GOLD_FOIL, GOLD_INK } from "../gold";
import { CardFooter, CardRoot, DISPLAY, FinisherStamp, footerUser, Poster, Stars, useCardName, useFinishedDate, useHeadline, useStats, type TemplateProps } from "../parts";

// The title in marquee caps on the lit board: condensed, so long titles still get big letters.
const TITLE_SIZES = {
  story: ["text-[124px]", "text-[98px]", "text-[78px]", "text-[62px]"],
  feed: ["text-[96px]", "text-[76px]", "text-[60px]", "text-[50px]"],
} as const;

// A bulb: a white-hot filament in amber glass. Every third one is between flashes, as on a chasing marquee.
const BULB = "radial-gradient(circle at 40% 36%, #fffef7 0 20%, #ffe7a8 40%, #f6b347 66%, #c47619 100%)";
const LIT = "0 0 12px 4px rgba(255, 204, 120, 0.8), 0 0 34px 12px rgba(255, 150, 40, 0.32)";
const DIM = "0 0 8px 2px rgba(255, 190, 100, 0.35)";
// The sign's lettering, lit: a warm core with its glow around it.
const NEON = "0 0 4px rgba(255, 244, 214, 0.9), 0 0 18px rgba(255, 196, 96, 0.9), 0 0 46px rgba(255, 140, 40, 0.6)";

/** A row (or column) of marquee bulbs along one side of the poster case. */
function Bulbs({ count, vertical = false, className }: { count: number; vertical?: boolean; className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute flex justify-between", vertical && "flex-col", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn("size-[24px] shrink-0 rounded-full", i % 3 === 1 && "opacity-60")}
          style={{ background: BULB, boxShadow: i % 3 === 1 ? DIM : LIT }}
        />
      ))}
    </div>
  );
}

/**
 * Pro (ADR 0084): opening night. The moment is up in lights on a gold marquee sign, the poster stands under glass in
 * a gold case ringed with bulbs, and the title is spelled out on the lit letter board below it, with the kind, year
 * and numbers on its rail. The rating and review make the poster's critic quote. Movies and series, Finish and
 * Progress. The case takes whatever height the rest leaves, so a card without a review gets a bigger poster.
 */
export function PremiereCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const name = useCardName(data);
  const stats = useStats(data);
  const story = size === "story";
  // "SERIES · 2016 · 35 HOURS · 42 EPISODES": what the board's rail says under the title (two numbers fit).
  const facts = [`${t("kind", { kind: data.kind })}${data.year ? ` · ${data.year}` : ""}`, ...stats.slice(0, 2).map((s) => `${s.value} ${s.label}`)].join(" · ");
  const quote = !!(data.rating || data.review);

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center px-[72px] pt-[64px] pb-[60px]", story ? "gap-[36px]" : "gap-[22px]")}>
      {/* House lights down: a warm spotlight on the case, the corners in shadow. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_48%_at_50%_42%,rgba(255,196,110,0.3),transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(0,0,0,0.62))]" />

      {/* The marquee sign: the moment in lights, the date under it. */}
      <div className="relative shrink-0 rounded-[28px] p-[12px] shadow-[0_18px_40px_rgba(0,0,0,0.5)]" style={{ background: GOLD_FOIL }}>
        <div
          className={cn(
            "flex flex-col items-center rounded-[18px] bg-[#140e0a] shadow-[inset_0_0_30px_rgba(0,0,0,0.9)]",
            story ? "gap-[12px] px-[64px] py-[26px]" : "gap-[8px] px-[48px] py-[16px]",
          )}
        >
          <p
            className={cn(
              DISPLAY,
              "max-w-[760px] truncate font-extrabold tracking-[0.14em] whitespace-nowrap text-[#fff4d8] uppercase [&:lang(th)]:tracking-normal",
              story ? "text-[66px]" : "text-[50px]",
              "leading-[1.05]",
            )}
            style={{ textShadow: NEON }}
          >
            {headline}
          </p>
          <p className={cn("font-bold tracking-[0.3em] whitespace-nowrap uppercase [&:lang(th)]:tracking-normal", story ? "text-[26px]" : "text-[22px]")} style={{ color: GOLD_INK }}>
            {date}
          </p>
        </div>
      </div>

      {/* The poster case: under glass in a gold frame, ringed with bulbs. */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative h-full rounded-[22px] p-[46px] shadow-[0_34px_80px_rgba(0,0,0,0.6),inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-4px_0_rgba(0,0,0,0.35)]"
          style={{ background: GOLD_FOIL }}
        >
          <Bulbs count={story ? 9 : 7} className="inset-x-[42px] top-[11px]" />
          <Bulbs count={story ? 9 : 7} className="inset-x-[42px] bottom-[11px]" />
          <Bulbs count={story ? 13 : 10} vertical className="inset-y-[42px] left-[11px]" />
          <Bulbs count={story ? 13 : 10} vertical className="inset-y-[42px] right-[11px]" />
          <div className="relative aspect-[2/3] h-full overflow-hidden rounded-[6px] shadow-[0_0_0_6px_rgba(20,14,10,0.88),0_10px_26px_rgba(0,0,0,0.5)]">
            <Poster url={data.posterUrl} className="absolute inset-0" />
            {!data.posterUrl && (
              // No poster: the title, printed across the lightbox.
              <div className="absolute inset-0 flex items-center justify-center p-[36px]">
                <p
                  className={cn(
                    DISPLAY,
                    "text-center font-extrabold text-white uppercase [font-stretch:75%] [overflow-wrap:anywhere]",
                    story ? "line-clamp-6 text-[76px]" : "line-clamp-4 text-[56px]",
                    "leading-[1.02]",
                  )}
                >
                  {name}
                </p>
              </div>
            )}
            {/* The glass: a soft sheen across its top corner. */}
            <span className="absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0.07)_28%,transparent_44%)]" />
          </div>
          <FinisherStamp
            data={data}
            className={cn("absolute rotate-[12deg]", story ? "-top-[46px] -right-[96px]" : "-top-[40px] -right-[84px] origin-top-right scale-[0.72]")}
          />
        </div>
      </div>

      {/* The letter board, lit from behind: the title in marquee caps, the facts on the rail under it. */}
      <div className="relative w-full shrink-0">
        <span className="mx-[26px] block h-[16px] rounded-t-[10px]" style={{ background: GOLD_FOIL }} />
        <div
          className={cn(
            "relative flex flex-col bg-[linear-gradient(180deg,#fffdf5,#efe4cc)] text-[#17110c] shadow-[0_0_80px_rgba(255,214,150,0.32),0_26px_60px_rgba(0,0,0,0.5)]",
            story ? "gap-[14px] px-[52px] py-[34px]" : "gap-[8px] px-[44px] py-[22px]",
          )}
        >
          {/* The rails the letters hang on. */}
          <span className="absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_70px,rgba(23,17,12,0.07)_70px_74px)]" />
          <h2
            data-fit=""
            className={cn(
              DISPLAY,
              "relative line-clamp-2 text-center font-extrabold tracking-[0.01em] uppercase [font-stretch:75%] [overflow-wrap:anywhere]",
              TITLE_SIZES[size][titleSizeStep(name)],
              "leading-[0.98]",
            )}
          >
            {name}
          </h2>
          <p className={cn("relative truncate text-center font-semibold tracking-[0.16em] uppercase opacity-75 [&:lang(th)]:tracking-normal", story ? "text-[30px]" : "text-[25px]")}>
            {facts}
          </p>
        </div>
        <span className="mx-[26px] block h-[16px] rounded-b-[10px]" style={{ background: GOLD_FOIL }} />
      </div>

      {/* The critic quote: the stars, and the review in quote marks. */}
      {quote && (
        <figure className={cn("relative flex w-full shrink-0 flex-col items-center text-center", story ? "gap-[14px]" : "gap-[6px]")}>
          <Stars rating={data.rating} className={cn("text-[#f5c451]", story ? "text-[58px]" : "text-[44px]")} />
          {data.review && (
            <blockquote className="w-full">
              <p
                data-fit=""
                className={cn(
                  "px-[24px] font-medium [overflow-wrap:anywhere] before:content-['“'] after:content-['”']",
                  story ? "line-clamp-2 text-[46px]/[1.22]" : "line-clamp-1 text-[36px]/[1.2]",
                )}
              >
                {data.review}
              </p>
            </blockquote>
          )}
        </figure>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative w-full shrink-0" />
    </CardRoot>
  );
}
