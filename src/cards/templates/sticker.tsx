import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, CardTitle, DISPLAY, Stars, footerUser, useFinishedDate, useHeadline, useStats, type TemplateProps } from "../parts";

// White ink with a soft shadow reads on almost any photo the sticker is placed on.
const INK = "text-white [text-shadow:0_4px_28px_rgba(0,0,0,0.45)]";

/**
 * Stats Sticker (S1 share artwork): just the stats on a transparent background, to place on the user's own
 * photo in IG Stories. No poster and no panel: the PNG keeps its alpha channel.
 */
export function StickerCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const stats = useStats(data);
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center justify-center gap-[48px] bg-transparent p-[96px] text-center", INK)}>
      {/* The stamp, outlined in white like a die-cut sticker. */}
      <div className="rotate-[-6deg] rounded-[20px] border-[7px] border-white px-[36px] py-[14px] shadow-[0_6px_30px_rgba(0,0,0,0.3)]">
        <p className={cn(DISPLAY, "max-w-[760px] truncate text-[64px] leading-none font-extrabold tracking-[0.08em] uppercase")}>{headline}</p>
      </div>

      <div className="flex w-full flex-col items-center gap-[16px]">
        <CardTitle data={data} size={size} className="line-clamp-2 w-full" />
        <p className="text-[36px] font-semibold opacity-90">
          {data.recap ? (
            t("titlesWatched", { count: data.recap.titleCount, period: data.recap.period ?? "week" })
          ) : data.atlas || data.shelf ? (
            // Atlas and Shelf cards are about no one title: only the day.
            date
          ) : (
            <>
              {t("kind", { kind: data.kind })}
              {" · "}
              {date}
            </>
          )}
        </p>
      </div>

      {stats.length > 0 && (
        <dl className="flex w-full justify-center gap-[72px]">
          {stats.map((s) => (
            <div key={s.label} className="flex min-w-0 flex-col items-center">
              <dd className={cn(DISPLAY, "font-extrabold whitespace-nowrap [font-stretch:75%]", story ? "text-[150px]" : "text-[120px]", "leading-[0.95]")}>
                {s.value}
              </dd>
              <dt className="mt-[8px] text-[30px] font-bold tracking-[0.16em] uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      <Stars rating={data.rating} className="text-[64px]" />
      <CardFooter host={host} {...footerUser(data)} className="w-full max-w-[860px] justify-center text-[30px]" />
    </CardRoot>
  );
}
