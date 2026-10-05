import { useTranslations } from "next-intl";
import type { RecapCollageTitle } from "@/core/cards/types";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, Poster, footerUser, useCardName, useHeadline, useStats, type TemplateProps } from "../parts";

/** Titles per shelf: five cases side by side on both sizes. */
const PER_SHELF = 5;

/**
 * The Shelf card (ADR 0095): the Shelf's top ten standing on a wooden bookcase, five to a shelf, each favourite
 * numbered in the owner's order. The story size lists the names under the bookcase in handwriting.
 */
export function ShelfCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const headline = useHeadline(data);
  const name = useCardName(data);
  const stats = useStats(data);
  const story = size === "story";
  const titles = data.shelf?.titles ?? [];
  const pinned = data.shelf?.pinned ?? 0;
  const shelves: RecapCollageTitle[][] = [];
  for (let i = 0; i < titles.length; i += PER_SHELF) shelves.push(titles.slice(i, i + PER_SHELF));

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[72px] pb-[64px]", story ? "gap-[56px] pt-[120px]" : "gap-[36px] pt-[64px]")}>
      <header className="flex flex-col gap-[12px]">
        <p className="text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase [&:lang(th)]:tracking-normal">{headline}</p>
        <p data-fit="" className={cn(DISPLAY, "truncate leading-[0.9] font-extrabold tracking-[-0.04em] [font-stretch:75%]", story ? "text-[170px]" : "text-[130px]")}>
          {name}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[48px]">
        {/* The bookcase: a dark back panel, a plank under each shelf. */}
        <div className="rounded-[14px] bg-[#3b2a1d] p-[22px] pb-0 shadow-[0_30px_60px_rgba(0,0,0,0.45)] ring-[10px] ring-[#6e4a2c]">
          {shelves.map((row, r) => (
            <div key={r} className="relative">
              <ol className={cn("flex items-end justify-center gap-[20px] px-[12px]", story ? "h-[300px]" : "h-[262px]")} start={r * PER_SHELF + 1}>
                {row.map((title, i) => {
                  const at = r * PER_SHELF + i;
                  return (
                    <li key={at} className={cn("relative shrink-0", story ? "w-[156px]" : "w-[148px]")}>
                      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[4px] border-l-[5px] border-black/45 shadow-[0_6px_10px_rgba(0,0,0,0.5)]">
                        <Poster url={title.posterUrl} className="absolute inset-0" />
                        {!title.posterUrl && (
                          <p className={cn(DISPLAY, at < pinned ? "pt-[46px]" : "pt-[10px]", "absolute inset-0 line-clamp-5 px-[10px] text-[24px] leading-[1.1] font-extrabold text-white [overflow-wrap:anywhere]")}>
                            {title.name}
                          </p>
                        )}
                        <span className="absolute inset-y-0 left-[6px] w-[10px] bg-white/15" />
                      </div>
                      {/* A favourite's place, like a numbered tag hung on the case. */}
                      {at < pinned && (
                        <span
                          className={cn(
                            DISPLAY,
                            "absolute -top-[22px] -left-[14px] flex size-[60px] items-center justify-center rounded-full bg-[var(--card-accent)] text-[32px] font-extrabold text-white shadow-[0_4px_10px_rgba(0,0,0,0.4)] ring-[4px] ring-[#3b2a1d]",
                          )}
                        >
                          {at + 1}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="-mx-[22px] h-[30px] bg-[linear-gradient(to_bottom,#c79a66_0_6px,#a0744a_6px_100%)] shadow-[0_8px_12px_rgba(0,0,0,0.35)]" />
            </div>
          ))}
        </div>

        {story && titles.length > 0 && (
          <ol className="grid grid-cols-2 gap-x-[40px] gap-y-[6px] [font-family:var(--card-hand)] text-[46px] leading-[1.15]">
            {titles.map((title, i) => (
              <li key={i} className="flex min-w-0 gap-[14px]">
                <span className="shrink-0 text-[var(--card-accent)]">{t("shelfRank", { rank: i + 1 })}</span>
                <span className="truncate">{title.name}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {stats.length > 0 && (
        <dl className="flex shrink-0 items-baseline gap-[24px] border-t-[4px] border-[var(--card-text)]/20 pt-[28px]">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 items-baseline gap-[18px]">
              <dd className={cn(DISPLAY, "leading-[0.9] font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", story ? "text-[120px]" : "text-[96px]")}>
                {s.value}
              </dd>
              <dt className="line-clamp-2 text-[30px] leading-tight tracking-[0.1em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
