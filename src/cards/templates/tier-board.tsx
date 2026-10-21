import { titleSizeStep } from "@/core/cards/text";
import { tierPosterHeight, tierRows } from "@/core/rankings";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, useCardName, useHeadline, type TemplateProps } from "../parts";
import { DoneMark, labelSize, RankThumb, TIER_COLOURS, useRanking } from "../rank-parts";

/** The list's name, smaller as it gets longer. */
const TITLE_STORY = ["text-[112px]", "text-[90px]", "text-[72px]", "text-[58px]"] as const;
const TITLE_FEED = ["text-[88px]", "text-[72px]", "text-[58px]", "text-[46px]"] as const;

/** The board's room for posters (px): its width beside the labels, and a height that fits a two-line name. */
const ROOM = { width: 760, story: 1240, feed: 800 } as const;
const GAP = 12;
/** Each row's padding, above and below. */
const ROW_PAD = 10;

/**
 * A tier list's free card (ADR 0099, step 2): a board pinned on the card's colour, a row per tier with its sticky note
 * (S red, A orange, B yellow…) and its posters, or places' outlines, wrapping when a row is long. The posters are as big
 * as the rows allow. Empty rows aren't drawn. A ✓ marks what the owner finished or has been to, unless they hid it.
 */
export function TierBoardCard({ data, size, palette, host }: TemplateProps) {
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
    story ? 380 : 300,
  );
  const paper = "color-mix(in oklab, var(--card-paper) 80%, var(--card-ink))";

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[56px] pb-[56px]", story ? "gap-[40px] pt-[110px]" : "gap-[28px] pt-[60px]")}>
      <header className="flex flex-col gap-[10px]">
        <p className="text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase [&:lang(th)]:tracking-normal">{headline}</p>
        <p data-fit="" className={cn(DISPLAY, "line-clamp-2 leading-[0.98] font-extrabold tracking-[-0.04em] [overflow-wrap:anywhere]", (story ? TITLE_STORY : TITLE_FEED)[titleSizeStep(name)])}>
          {name}
        </p>
      </header>

      {/* The board: paper, a strip of tape at the top, the rows ruled apart. */}
      <div className="relative flex min-h-0 flex-1 flex-col rounded-[10px] bg-[var(--card-paper)] px-[20px] py-[16px] text-[var(--card-ink)] shadow-[0_24px_50px_rgba(0,0,0,0.35)]">
        <span className="absolute -top-[18px] left-1/2 h-[44px] w-[200px] -translate-x-1/2 rotate-[-3deg] bg-white/55 shadow-sm" />
        {rows.map((row, r) => (
          <div
            key={row.tier}
            className={cn("flex flex-[1_0_auto] items-center gap-[16px]", r > 0 && "border-t-[3px] border-dashed border-[var(--card-ink)]/20")}
            style={{ paddingBlock: ROW_PAD }}
          >
            <div
              className={cn(DISPLAY, "flex w-[150px] shrink-0 items-center justify-center self-stretch rounded-[6px] px-[8px] text-center leading-[0.95] font-extrabold text-[#1d1a16] shadow-[0_6px_14px_rgba(0,0,0,0.22)] [overflow-wrap:anywhere]", r % 2 ? "rotate-[1deg]" : "rotate-[-1deg]")}
              style={{ background: TIER_COLOURS[row.tier % TIER_COLOURS.length], fontSize: labelSize(row.label, poster), minHeight: poster }}
            >
              {row.label}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap content-center" style={{ gap: GAP }}>
              {row.items.map((item) => (
                <div key={item.ref} className="relative shrink-0" style={{ height: poster }}>
                  <RankThumb
                    item={item}
                    fill="var(--card-accent)"
                    paper={paper}
                    caption={{ size: Math.max(14, poster * 0.11), color: "var(--card-ink)" }}
                    className="h-full rounded-[5px] shadow-[0_4px_10px_rgba(0,0,0,0.28)]"
                  />
                  {showDone && item.done && (
                    <span
                      className="absolute -top-[6px] -right-[6px] flex items-center justify-center rounded-full border-[3px] border-[var(--card-paper)] bg-[var(--card-stamp)] text-white shadow-md"
                      style={{ width: Math.max(26, poster * 0.2), height: Math.max(26, poster * 0.2) }}
                    >
                      <DoneMark className="size-[62%]" />
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
