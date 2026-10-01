import { useTranslations } from "next-intl";
import type { SurvivedKey } from "@/core/catalog/dtdd";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, CardTitle, DISPLAY, FinisherStamp, Poster, Stars, footerUser, useFinishedDate, type TemplateProps } from "../parts";

/** The scare on the patch. */
const EMOJI: Record<SurvivedKey, string> = {
  jumpScares: "👻",
  zombies: "🧟",
  possession: "😈",
  ghosts: "🕯️",
  clowns: "🤡",
  dolls: "🪆",
  gore: "🩸",
  spiders: "🕷️",
  snakes: "🐍",
  sharks: "🦈",
  needles: "💉",
};

/**
 * Survived (S2 content warnings): an embroidered merit patch sewn into the album next to the taped-in poster, for
 * finishing a movie or series DTDD says has jump scares, zombies, clowns, … ("Survived the jump scares 👻").
 */
export function SurvivedCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const story = size === "story";
  const scare = data.survived ?? "jumpScares";

  return (
    <CardRoot size={size} palette={palette} className="items-center p-[72px]">
      <div className={cn("relative w-full shrink-0", story ? "mt-[40px] h-[860px]" : "mt-[8px] h-[560px]")}>
        {/* The poster, taped in at a tilt. */}
        <div
          className={cn(
            "absolute top-0 left-[8px] rotate-[-5deg] bg-[var(--card-paper)] p-[22px] shadow-[0_24px_60px_rgba(0,0,0,0.4)]",
            story ? "w-[500px]" : "w-[340px]",
          )}
        >
          <Poster url={data.posterUrl} className="aspect-[2/3] w-full" />
          <span className="absolute -top-[26px] left-1/2 h-[56px] w-[200px] -translate-x-1/2 rotate-[4deg] bg-[var(--card-accent)] opacity-70" />
        </div>

        <FinisherStamp
          data={data}
          className={cn("absolute z-10 rotate-[-10deg]", story ? "top-0 right-[40px]" : "top-[360px] left-[250px] origin-top-left scale-[0.7]")}
        />
        {/* The patch: a stitched badge with the scare, and the ribbon. */}
        <div
          className={cn(
            "absolute right-[4px] bottom-0 flex rotate-[8deg] flex-col items-center",
            story ? "w-[560px]" : "w-[480px]",
          )}
        >
          <div
            className={cn(
              "flex aspect-square w-full items-center justify-center rounded-full bg-[var(--card-accent)] p-[18px] shadow-[0_22px_50px_rgba(0,0,0,0.45)]",
            )}
          >
            <div className="flex size-full items-center justify-center rounded-full border-[8px] border-dashed border-[var(--card-paper)]">
              <span className={cn("leading-none", story ? "text-[260px]" : "text-[220px]")}>{EMOJI[scare]}</span>
            </div>
          </div>
          <div
            className={cn(
              DISPLAY,
              "-mt-[70px] rotate-[-4deg] rounded-[10px] border-[5px] border-dashed border-[var(--card-stamp)] bg-[var(--card-paper)] px-[40px] py-[14px] text-[var(--card-stamp)] shadow-[0_12px_30px_rgba(0,0,0,0.35)]",
              "text-[64px] leading-none font-extrabold tracking-[0.12em] whitespace-nowrap uppercase",
            )}
          >
            {t("survivedBadge")}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[20px] text-center">
        <p className={cn("px-[12px] leading-[1.1] text-[var(--card-accent)] [font-family:var(--card-hand)]", story ? "text-[84px]" : "text-[64px]")}>
          {t("survivedHeadline", { scare })}
        </p>
        <CardTitle data={data} size={size} className={cn("px-[12px]", story ? "line-clamp-2" : "line-clamp-2 text-[52px]")} />
        <div className="flex items-center gap-[28px] text-[40px] font-semibold text-[var(--card-muted)]">
          <span className="whitespace-nowrap">{date}</span>
          <Stars rating={data.rating} className="shrink-0 text-[44px] text-[var(--card-accent)]" />
        </div>
      </div>

      <CardFooter host={host} {...footerUser(data)} className="w-full shrink-0" />
    </CardRoot>
  );
}
