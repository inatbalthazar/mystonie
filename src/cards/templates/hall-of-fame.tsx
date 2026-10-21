import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { GOLD_FOIL, GOLD_INK } from "../gold";
import { GOLD_SERIF as SERIF, IVORY, STAMPED, VelvetBackdrop } from "../pro-velvet";
import { CardFooter, CardRoot, footerUser, useCardName, useHeadline, type TemplateProps } from "../parts";
import { DoneMark, RankThumb, useRanking } from "../rank-parts";

/** The list's name, smaller as it gets longer. */
const TITLE_STORY = ["text-[112px]", "text-[92px]", "text-[72px]", "text-[58px]"] as const;
const TITLE_FEED = ["text-[90px]", "text-[74px]", "text-[58px]", "text-[46px]"] as const;

/** 1 → I, 4 → IV, 10 → X: places on a hall of fame are carved, not printed. */
export function roman(n: number): string {
  const marks: [number, string][] = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let left = n;
  for (const [value, mark] of marks) {
    while (left >= value) {
      out += mark;
      left -= value;
    }
  }
  return out;
}

/** A laurel branch (the left one; the right is mirrored), around number one's numeral. */
function Laurel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 140" aria-hidden="true" className={className} fill={GOLD_INK}>
      <path d="M44 136C20 112 12 76 22 34" fill="none" stroke={GOLD_INK} strokeWidth="3" strokeLinecap="round" />
      {[18, 36, 54, 72, 90, 108].map((y, i) => (
        <g key={y} transform={`translate(${24 - i * 1.2} ${y}) rotate(${-38 + i * 6})`}>
          <ellipse cx="-9" cy="0" rx="12" ry="5" />
          <ellipse cx="9" cy="2" rx="11" ry="4.5" transform="rotate(50)" />
        </g>
      ))}
    </svg>
  );
}

/**
 * A ranking's Pro card (ADR 0099): a hall of fame. Black velvet inside a gilt frame, the list's name in gold, number
 * one's poster (or the place's outline) in a foil frame under laurels, the rest carved in Roman numerals on gold
 * rules, and a gold Pro seal pinned in the corner, so the card says it was made with Pro.
 */
export function HallOfFameCard({ data, size, palette, host }: TemplateProps) {
  const headline = useHeadline(data);
  const name = useCardName(data);
  const { items, showDone, showNotes } = useRanking(data);
  const story = size === "story";
  const [first, ...rest] = items;
  const twoColumns = !story && rest.length > 5;
  const rows = twoColumns ? Math.ceil(rest.length / 2) : rest.length;

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[110px] text-[#f3ead6]", story ? "gap-[40px] pt-[150px] pb-[96px]" : "gap-[24px] pt-[104px] pb-[80px]")}>
      <VelvetBackdrop size={size} />

      <header className="relative flex flex-col items-center gap-[10px] text-center">
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

      {first && (
        <div className={cn("relative flex min-h-0 items-center justify-center gap-[40px]", rest.length > 0 ? (story ? "flex-[2.2]" : "flex-[1.9]") : "flex-1")}>
          <div className="relative h-full max-h-[640px] rounded-[4px] p-[9px] shadow-[0_18px_40px_rgba(0,0,0,0.6)]" style={{ background: GOLD_FOIL }}>
            <RankThumb item={first} fill={GOLD_INK} paper="#16100b" className="h-full rounded-[2px]" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[12px]">
            <div className="flex items-center gap-[4px]">
              <Laurel className="h-[130px] w-[56px]" />
              <span className={cn(SERIF, "px-[6px] text-[120px] leading-none font-bold")} style={{ color: GOLD_INK, textShadow: STAMPED }}>
                {roman(1)}
              </span>
              <Laurel className="h-[130px] w-[56px] -scale-x-100" />
            </div>
            <p className={cn(SERIF, "line-clamp-3 leading-[1.02] font-bold [overflow-wrap:anywhere]", story ? "text-[64px]" : "text-[52px]")} style={{ color: IVORY }}>
              {first.name}
            </p>
            {(first.year || (showDone && first.done)) && (
              <p className="flex items-center gap-[14px] text-[28px] font-semibold tracking-[0.18em] uppercase [&:lang(th)]:tracking-normal" style={{ color: GOLD_INK }}>
                {first.year}
                {showDone && first.done && <DoneMark className="size-[34px]" />}
              </p>
            )}
            {showNotes && first.note && <p className={cn(SERIF, "line-clamp-2 text-[40px] leading-[1.1] italic opacity-85")}>{first.note}</p>}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <ol
          start={2}
          className={cn("relative grid min-h-0 w-full flex-[3] gap-x-[34px]", twoColumns ? "grid-flow-col grid-cols-[repeat(2,minmax(0,1fr))]" : "grid-cols-[minmax(0,1fr)]")}
          style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        >
          {rest.map((item, i) => (
            <li key={item.ref} className="flex min-h-0 items-center gap-[22px] border-t-[1.5px] py-[8px]" style={{ borderColor: `color-mix(in oklab, ${GOLD_INK} 45%, transparent)` }}>
              <span className={cn(SERIF, "w-[96px] shrink-0 text-right leading-none font-bold", rows > 6 ? "text-[50px]" : "text-[64px]")} style={{ color: GOLD_INK, textShadow: STAMPED }}>
                {roman(i + 2)}
              </span>
              <div className="h-full shrink-0 rounded-[2px] p-[4px]" style={{ background: GOLD_FOIL }}>
                <RankThumb item={item} fill={GOLD_INK} paper="#16100b" className="h-full" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className={cn(SERIF, "flex min-w-0 items-center gap-[12px] leading-[1.05] font-bold", rows <= 2 ? "text-[54px]" : rows <= 4 ? "text-[46px]" : "text-[38px]")} style={{ color: IVORY }}>
                  <span className="min-w-0 truncate">{item.name}</span>
                  {showDone && item.done && <DoneMark className="size-[0.7em] shrink-0" style={{ color: GOLD_INK }} />}
                </p>
                {showNotes && item.note && rows <= 6 && <p className={cn(SERIF, "truncate text-[32px] italic opacity-80")}>{item.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
