import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, useCardName, useHeadline, type TemplateProps } from "../parts";
import { DoneMark, RankThumb, useRanking } from "../rank-parts";

/** The list's name, smaller as it gets longer. */
const TITLE_STORY = ["text-[128px]", "text-[100px]", "text-[78px]", "text-[62px]"] as const;
const TITLE_FEED = ["text-[100px]", "text-[80px]", "text-[62px]", "text-[50px]"] as const;

/** A name's size on a row, by how many rows share the page (fewer rows, bigger names). */
function nameSize(rows: number, story: boolean): string {
  if (rows <= 2) return story ? "text-[58px]" : "text-[50px]";
  if (rows <= 4) return story ? "text-[48px]" : "text-[40px]";
  if (rows <= 6) return story ? "text-[40px]" : "text-[34px]";
  return story ? "text-[34px]" : "text-[30px]";
}

/**
 * A ranking's free card (ADR 0099): a countdown torn out of a notebook and taped onto the card's colour. Number one
 * leads, big, its poster (or the place's outline) beside a huge numeral; the rest follow on ruled lines, two columns of
 * them on the feed size when there are many. A ✓ marks what the owner finished or has been to, unless they hid it.
 */
export function CountdownCard({ data, size, palette, host }: TemplateProps) {
  const headline = useHeadline(data);
  const name = useCardName(data);
  const { items, showDone, showNotes } = useRanking(data);
  const story = size === "story";
  const [first, ...rest] = items;
  const twoColumns = !story && rest.length > 5;
  const rows = twoColumns ? Math.ceil(rest.length / 2) : rest.length;
  const ink = palette.ink;
  const nameStep = titleSizeStep(name);

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[64px] pb-[56px]", story ? "gap-[44px] pt-[110px]" : "gap-[30px] pt-[60px]")}>
      <header className="flex flex-col gap-[10px]">
        <p className="text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase [&:lang(th)]:tracking-normal">{headline}</p>
        <p data-fit="" className={cn(DISPLAY, "line-clamp-2 leading-[0.98] font-extrabold tracking-[-0.04em] [overflow-wrap:anywhere]", (story ? TITLE_STORY : TITLE_FEED)[nameStep])}>
          {name}
        </p>
      </header>

      {/* The notebook page: ruled, a margin line, two strips of tape, a little crooked. */}
      <div
        className="relative flex min-h-0 flex-1 rotate-[-0.6deg] flex-col rounded-[10px] bg-[var(--card-paper)] px-[36px] py-[34px] text-[var(--card-ink)] shadow-[0_24px_50px_rgba(0,0,0,0.35)]"
        style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 63px, color-mix(in oklab, ${ink} 9%, transparent) 63px 65px)` }}
      >
        <span className="absolute inset-y-0 left-[118px] w-[3px] bg-[var(--card-stamp)]/35" />
        <span className="absolute -top-[18px] left-[90px] h-[44px] w-[180px] rotate-[-5deg] bg-white/55 shadow-sm" />
        <span className="absolute -top-[16px] right-[80px] h-[44px] w-[150px] rotate-[4deg] bg-white/55 shadow-sm" />

        {first && (
          <div className={cn("relative flex min-h-0 items-center gap-[30px]", rest.length > 0 ? (story ? "flex-[2.3]" : "flex-[2]") : "flex-1")}>
            <span className={cn(DISPLAY, "w-[150px] shrink-0 text-center leading-none font-extrabold text-[var(--card-stamp)]", story ? "text-[230px]" : "text-[190px]")}>{1}</span>
            <div className="relative h-full max-h-[620px] shrink-0 py-[6px]">
              <RankThumb item={first} fill="var(--card-accent)" paper="color-mix(in oklab, var(--card-paper) 80%, var(--card-ink))" className="h-full rounded-[6px] shadow-[0_10px_22px_rgba(0,0,0,0.35)]" />
              {showDone && first.done && <Done className="-right-[18px] -bottom-[6px] size-[78px]" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
              <p className={cn(DISPLAY, "line-clamp-3 leading-[1.02] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]", story ? "text-[72px]" : "text-[58px]")}>
                {first.name}
              </p>
              {first.year && <p className="text-[32px] font-semibold opacity-60">{first.year}</p>}
              {showNotes && first.note && <p className="line-clamp-2 [font-family:var(--card-hand)] text-[48px] leading-[1.05] text-[var(--card-stamp)]">{first.note}</p>}
            </div>
          </div>
        )}

        {rest.length > 0 && (
          <ol
            start={2}
            className={cn("mt-[20px] grid min-h-0 flex-[3] gap-x-[28px] gap-y-[12px] border-t-[3px] border-dashed border-[var(--card-ink)]/25 pt-[22px]", twoColumns ? "grid-flow-col grid-cols-[repeat(2,minmax(0,1fr))]" : "grid-cols-[minmax(0,1fr)]")}
            style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
          >
            {rest.map((item, i) => (
              <li key={item.ref} className="flex min-h-0 items-center gap-[20px]">
                <span className={cn(DISPLAY, "w-[86px] shrink-0 text-right leading-none font-extrabold text-[var(--card-stamp)]", rows > 6 ? "text-[56px]" : "text-[72px]")}>
                  {i + 2}
                </span>
                <div className="relative h-full shrink-0 py-[3px]">
                  <RankThumb item={item} fill="var(--card-accent)" paper="color-mix(in oklab, var(--card-paper) 80%, var(--card-ink))" className="h-full rounded-[4px] shadow-[0_4px_10px_rgba(0,0,0,0.3)]" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className={cn(DISPLAY, "flex min-w-0 items-center gap-[12px] leading-[1.05] font-extrabold", nameSize(rows, story))}>
                    <span className="min-w-0 truncate">{item.name}</span>
                    {showDone && item.done && <DoneMark className="size-[0.8em] shrink-0 text-[var(--card-stamp)]" />}
                  </p>
                  {showNotes && item.note && rows <= 6 && (
                    <p className="truncate [font-family:var(--card-hand)] text-[36px] leading-[1.1] text-[var(--card-stamp)]">{item.note}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}

/** A round ✓ stamp pressed onto number one's corner. */
function Done({ className }: { className?: string }) {
  return (
    <span className={cn("absolute flex rotate-[-10deg] items-center justify-center rounded-full border-[5px] border-[var(--card-stamp)] bg-[var(--card-paper)] text-[var(--card-stamp)] shadow-md", className)}>
      <DoneMark className="size-[62%]" />
    </span>
  );
}
