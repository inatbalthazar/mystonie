import { titleSizeStep } from "@/core/cards/text";
import { tierPosterHeight, tierRows } from "@/core/rankings";
import { cn } from "@/lib/utils";
import { GOLD_FOIL, GOLD_INK } from "../gold";
import { CardFooter, CardRoot, footerUser, useCardName, useHeadline, type TemplateProps } from "../parts";
import { GOLD_SERIF as SERIF, IVORY, STAMPED, VelvetBackdrop } from "../pro-velvet";
import { DoneMark, labelSize, RankThumb, useRanking } from "../rank-parts";

/** The list's name, smaller as it gets longer. */
const TITLE_STORY = ["text-[104px]", "text-[86px]", "text-[68px]", "text-[54px]"] as const;
const TITLE_FEED = ["text-[84px]", "text-[68px]", "text-[54px]", "text-[44px]"] as const;

/** The room for frames (px) inside the gilt frame, beside the plaques. */
const ROOM = { width: 700, story: 1180, feed: 760 } as const;
const GAP = 12;
const ROW_PAD = 10;
/** The foil around each poster. */
const FRAME = 3;

/**
 * A tier list's Pro card (ADR 0099, step 2): the Hall of Fame's velvet, gilt frame and PRO seal, each row behind a gold
 * plaque engraved with its label, its posters (or places' outlines in gold) in thin foil frames, the rows parted by gold
 * rules.
 */
export function TierGoldCard({ data, size, palette, host }: TemplateProps) {
  const headline = useHeadline(data);
  const name = useCardName(data);
  const { showDone } = useRanking(data);
  const story = size === "story";
  const rows = data.ranking ? tierRows(data.ranking) : [];
  const poster = tierPosterHeight(
    rows.map((r) => r.items.length),
    ROOM.width,
    (story ? ROOM.story : ROOM.feed) - rows.length * ROW_PAD * 2,
    GAP,
    story ? 360 : 280,
  );
  const rule = `color-mix(in oklab, ${GOLD_INK} 45%, transparent)`;

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[100px] text-[#f3ead6]", story ? "gap-[36px] pt-[150px] pb-[96px]" : "gap-[22px] pt-[104px] pb-[80px]")}>
      <VelvetBackdrop size={size} />

      <header className="relative flex flex-col items-center gap-[10px] px-[60px] text-center">
        <p className={cn(SERIF, "text-[34px] font-bold tracking-[0.3em] uppercase [&:lang(th)]:tracking-normal")} style={{ color: GOLD_INK }}>
          {headline}
        </p>
        <p
          data-fit=""
          className={cn(SERIF, "line-clamp-2 max-w-[760px] leading-[1.02] font-bold [overflow-wrap:anywhere]", (story ? TITLE_STORY : TITLE_FEED)[titleSizeStep(name)])}
          style={{ color: GOLD_INK, textShadow: STAMPED }}
        >
          {name}
        </p>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {rows.map((row, r) => (
          <div key={row.tier} className={cn("flex flex-[1_0_auto] items-center gap-[20px]", r > 0 && "border-t-[1.5px]")} style={{ paddingBlock: ROW_PAD, borderColor: rule }}>
            <div className="w-[130px] shrink-0 self-stretch rounded-[4px] p-[4px] shadow-[0_8px_18px_rgba(0,0,0,0.5)]" style={{ background: GOLD_FOIL, minHeight: poster }}>
              <div
                className={cn(SERIF, "flex size-full items-center justify-center rounded-[2px] border-[1.5px] border-[#5a3d10]/50 px-[6px] text-center leading-[0.95] font-bold text-[#3a2606] [overflow-wrap:anywhere]")}
                style={{ fontSize: labelSize(row.label, poster) }}
              >
                {row.label}
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap content-center" style={{ gap: GAP }}>
              {row.items.map((item) => (
                <div key={item.ref} className="relative shrink-0 rounded-[2px] shadow-[0_8px_18px_rgba(0,0,0,0.55)]" style={{ height: poster, padding: FRAME, background: GOLD_FOIL }}>
                  <RankThumb item={item} fill={GOLD_INK} paper="#16100b" caption={{ size: Math.max(14, poster * 0.1), color: IVORY }} className="h-full rounded-[1px]" />
                  {showDone && item.done && (
                    <span
                      className="absolute -top-[7px] -right-[7px] flex items-center justify-center rounded-full text-[#3a2606] shadow-[0_3px_8px_rgba(0,0,0,0.6)]"
                      style={{ background: GOLD_FOIL, width: Math.max(26, poster * 0.2), height: Math.max(26, poster * 0.2) }}
                    >
                      <DoneMark className="size-[60%]" />
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
