import { useTranslations } from "next-intl";
import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import {
  CardFooter,
  CardRoot,
  DISPLAY,
  FinishedStamp,
  FinisherStamp,
  footerUser,
  Poster,
  Review,
  Stars,
  useCardName,
  useFinishedDate,
  useStats,
  type TemplateProps,
} from "../parts";

// The title sits on the cartridge's label, narrower than other templates' titles, so it gets its own size steps.
const TITLE_SIZES = {
  story: ["text-[88px]", "text-[72px]", "text-[58px]", "text-[48px]"],
  feed: ["text-[68px]", "text-[56px]", "text-[48px]", "text-[40px]"],
} as const;

/**
 * A game cartridge taped into the album (S3 games): the game's key art on the label, landscape as RAWG draws it, the
 * title printed under it and the FINISHED stamp on the art's corner; grip ridges on top and the connector notch below.
 * Under it, the hours played (or the average), the rating and the review. The art takes whatever height those leave,
 * so a card without a review isn't left half empty. For games.
 */
export function CartridgeCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const name = useCardName(data);
  const [stat] = useStats(data);
  const story = size === "story";
  const notes = !!(stat || data.rating || data.review);

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center p-[72px]", story ? "gap-[44px]" : "gap-[28px]")}>
      {/* Tape holding the cartridge onto the page. */}
      <span className="absolute top-[52px] left-[120px] z-10 h-[64px] w-[220px] rotate-[-12deg] bg-[var(--card-accent)] opacity-75" />
      <span className="absolute top-[60px] right-[110px] z-10 h-[64px] w-[200px] rotate-[9deg] bg-[var(--card-paper)] opacity-60" />

      <div
        className={cn(
          "relative flex min-h-0 w-full flex-1 rotate-[-1.5deg] flex-col items-center rounded-t-[56px] rounded-b-[28px] bg-[#2b2a33] px-[44px] shadow-[0_30px_70px_rgba(0,0,0,0.45),inset_0_5px_0_rgba(255,255,255,0.14),inset_0_-8px_0_rgba(0,0,0,0.35)] ring-[5px] ring-white/10",
          story ? "mt-[36px] gap-[30px] pt-[36px] pb-[68px]" : "mt-[20px] gap-[22px] pt-[26px] pb-[52px]",
        )}
      >
        {/* Grip ridges moulded into the plastic. */}
        <div className="flex w-[58%] shrink-0 flex-col gap-[14px]">
          {Array.from({ length: story ? 4 : 3 }, (_, i) => (
            <span key={i} className="h-[9px] rounded-full bg-black/35 shadow-[0_2px_0_rgba(255,255,255,0.12)]" />
          ))}
        </div>

        {/* The label: key art over the printed title. */}
        <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[20px] bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[inset_0_0_0_6px_rgba(0,0,0,0.08)]">
          <div className={cn("relative min-h-0 flex-1", story ? "min-h-[400px]" : "min-h-[240px]")}>
            <Poster url={data.posterUrl} className="absolute inset-0" />
            <FinishedStamp
              kind={data.kind}
              date={date}
              className={cn("absolute right-[28px] bottom-[24px] rotate-[-9deg] bg-[var(--card-paper)]", !story && "origin-bottom-right scale-[0.85]")}
            />
          </div>
          <div className={cn("flex shrink-0 flex-col px-[36px]", story ? "gap-[10px] py-[30px]" : "gap-[6px] py-[22px]")}>
            <p className="truncate text-[26px] font-bold tracking-[0.2em] uppercase opacity-60">
              {t("kind", { kind: data.kind })}
              {data.year ? ` · ${data.year}` : ""}
            </p>
            <h2
              data-fit=""
              className={cn(DISPLAY, "line-clamp-2 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]", TITLE_SIZES[size][titleSizeStep(name)], "leading-[1.05]")}
            >
              {name}
            </h2>
          </div>
        </div>

        {/* The connector notch at the bottom edge. */}
        <span className="absolute bottom-0 left-1/2 h-[30px] w-[42%] -translate-x-1/2 rounded-t-[14px] bg-[var(--card-bg)]" />
        <FinisherStamp
          data={data}
          className={cn("absolute rotate-[-12deg]", story ? "top-[70px] -left-[40px]" : "top-[30px] -left-[36px] origin-top-left scale-[0.72]")}
        />
      </div>

      {notes && (
        <div className={cn("flex w-full shrink-0 flex-col px-[12px]", story ? "gap-[24px]" : "gap-[14px]")}>
          {stat && (
            <div className="flex min-w-0 items-baseline gap-[24px]">
              <p data-fit="" className={cn(DISPLAY, "shrink-0 font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", story ? "text-[150px]" : "text-[104px]", "leading-[0.9]")}>
                {stat.value}
              </p>
              <p className={cn("min-w-0 truncate tracking-[0.12em] text-[var(--card-muted)] uppercase", story ? "text-[38px]" : "text-[30px]")}>{stat.label}</p>
            </div>
          )}
          <Stars rating={data.rating} className={cn("text-[var(--card-accent)]", story ? "text-[60px]" : "text-[48px]")} />
          <Review
            text={data.review}
            className={cn(
              // Side padding keeps script glyph overhang inside the box (clamped text must not scroll).
              "px-[6px] text-[var(--card-muted)] [font-family:var(--card-hand)]",
              story ? "line-clamp-2 text-[56px]/[1.15]" : "line-clamp-1 text-[46px]/[1.15]",
            )}
          />
        </div>
      )}

      <CardFooter host={host} username={footerUser(data)} className="w-full shrink-0" />
    </CardRoot>
  );
}
