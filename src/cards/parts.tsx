// Building blocks shared by card templates. Cards are laid out at export size (1080px wide)
// in real pixels; previews scale the whole card with CSS (see card-preview.tsx).
import { StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { CARD_DIMENSIONS, type CardData, type CardRecap, type CardSize, type Palette } from "@/core/cards/types";
import { titleSizeStep, watchMinutes } from "@/core/cards/text";
import { recapFigures } from "@/core/stats/recap";
import { cn } from "@/lib/utils";

export type TemplateProps = { data: CardData; size: CardSize; palette: Palette; host: string };

// KR/JP variables exist only once cjk-fonts.ts has loaded, hence their fallbacks.
const NOTO = "var(--font-noto-thai), var(--font-noto-kr, sans-serif), var(--font-noto-jp, sans-serif), ui-sans-serif, sans-serif";

/** Display face (Bricolage Grotesque, slightly condensed) for headlines and numbers. */
export const DISPLAY = "[font-family:var(--card-display)] [font-stretch:87.5%]";

/** Fixed-size card root: palette as CSS variables, Noto fallbacks in the font stack. */
export function CardRoot({ size, palette, className, children }: { size: CardSize; palette: Palette; className?: string; children: ReactNode }) {
  const { width, height } = CARD_DIMENSIONS[size];
  const vars = {
    width,
    height,
    "--card-bg": palette.background,
    "--card-surface": palette.surface,
    "--card-text": palette.text,
    "--card-muted": palette.muted,
    "--card-accent": palette.accent,
    "--card-paper": palette.paper,
    "--card-ink": palette.ink,
    // Noto families use unicode-range, so a card only downloads the scripts it contains.
    fontFamily: `var(--font-sans), ${NOTO}`,
    // Brand display face for headlines and numbers; handwriting for polaroid captions.
    "--card-display": `var(--font-bricolage), ${NOTO}`,
    "--card-hand": `var(--font-caveat), ${NOTO}`,
    // Stamp ink: the brand coral (reads on the paper stock).
    "--card-stamp": "#cf3c12",
  } as CSSProperties;
  return (
    <div
      data-card=""
      style={vars}
      className={cn("relative flex shrink-0 flex-col overflow-hidden bg-[var(--card-bg)] text-[var(--card-text)]", className)}
    >
      {children}
    </div>
  );
}

/** Poster image, or a palette gradient when there is none. */
export function Poster({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div
      className={cn("overflow-hidden bg-[linear-gradient(135deg,var(--card-surface),var(--card-accent))]", className)}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- exported to PNG; must be a plain CORS image
        <img
          src={url}
          alt=""
          crossOrigin="anonymous"
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="size-full object-cover"
        />
      )}
    </div>
  );
}

const TITLE_SIZES = {
  story: ["text-[124px]", "text-[96px]", "text-[76px]", "text-[60px]"],
  feed: ["text-[104px]", "text-[80px]", "text-[64px]", "text-[52px]"],
} as const;

/** "Sep 21 – 27" for a recap week; stats cards longer than a week add the year (calendar dates, so UTC). */
export function useRecapRange(recap: CardRecap | null | undefined): string {
  const format = useFormatter();
  if (!recap) return "";
  const date = (key: string) => new Date(`${key}T00:00:00Z`);
  const year = recap.period && recap.period !== "week" ? "numeric" : undefined;
  return format.dateTimeRange(date(recap.from), date(recap.to), { month: "short", day: "numeric", year, timeZone: "UTC" });
}

/** What the card's big title says: the title's name, or the week on a recap. */
export function useCardName(data: CardData): string {
  const range = useRecapRange(data.recap);
  return data.recap ? range : data.name;
}

/** Card headline, shrinking by length and clamped to 3 lines so nothing overflows. */
export function CardTitle({ data, size, className }: { data: CardData; size: CardSize; className?: string }) {
  const name = useCardName(data);
  return (
    <h2
      data-fit=""
      className={cn(
        DISPLAY,
        "line-clamp-3 font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]",
        TITLE_SIZES[size][titleSizeStep(name)],
        className,
        // Last: tailwind-merge drops a leading-* that comes before a text-* size.
        "leading-[1.05]",
      )}
    >
      {name}
    </h2>
  );
}

export function Stars({ rating, className }: { rating?: number | null; className?: string }) {
  if (!rating) return null;
  return (
    <div className={cn("flex gap-2", className)}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rating >= i ? 1 : rating >= i - 0.5 ? 0.5 : 0;
        return (
          <span key={i} className="relative size-[1em]">
            <StarIcon className="absolute inset-0 size-full opacity-30" strokeWidth={1.5} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <StarIcon className="size-[1em] fill-current" strokeWidth={1.5} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function Review({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return (
    <p data-fit="" className={cn("line-clamp-3 [overflow-wrap:anywhere]", className)}>
      {text}
    </p>
  );
}

/** "Finished 26 Sep 2026", in the UI locale. The date is a calendar date, so format it in UTC. */
export function useFinishedDate(data: CardData): string {
  const format = useFormatter();
  const [y, m, d] = data.finishedOn.split("-").map(Number);
  return format.dateTime(new Date(Date.UTC(y!, m! - 1, d!)), { dateStyle: "medium", timeZone: "UTC" });
}

/** Stat blocks a template can show: watch time, episodes, seasons (only the known ones the user didn't hide). */
export function useStats(data: CardData): { value: string; label: string }[] {
  const t = useTranslations("Card");
  const format = useFormatter();
  const stats: { value: string; label: string }[] = [];
  const hidden = new Set(data.hide ?? []);
  if (data.recap) {
    return recapFigures(data.recap, { time: hidden.has("time"), episodes: hidden.has("episodes") }).map(({ key, value }) => ({
      value: format.number(value),
      label: key === "finished" ? t("titlesFinished", { count: value }) : key === "episodes" ? t("episodes", { count: value }) : t(key),
    }));
  }
  if (data.progress) {
    const { watched, total, watchedMin } = data.progress;
    if (!hidden.has("episodes")) stats.push({ value: `${format.number(watched)}/${format.number(total)}`, label: t("episodes", { count: total }) });
    if (!hidden.has("time") && watchedMin) {
      stats.push(
        watchedMin >= 120
          ? { value: format.number(Math.round(watchedMin / 60)), label: t("hours") }
          : { value: format.number(watchedMin), label: t("minutes") },
      );
    }
    return stats;
  }
  const minutes = hidden.has("time") ? null : watchMinutes(data);
  if (minutes) {
    stats.push(
      // A movie's runtime reads best in minutes ("133 min"); a series' total in hours.
      data.kind === "series" && minutes >= 120
        ? { value: format.number(Math.round(minutes / 60)), label: t("hours") }
        : { value: format.number(minutes), label: t("minutes") },
    );
  }
  if (data.kind === "series" && data.episodeCount && !hidden.has("episodes")) {
    stats.push({ value: format.number(data.episodeCount), label: t("episodes", { count: data.episodeCount }) });
  }
  if (data.kind === "series" && data.seasonCount && !hidden.has("seasons")) {
    stats.push({ value: format.number(data.seasonCount), label: t("seasons", { count: data.seasonCount }) });
  }
  return stats;
}

/**
 * The card's headline word: "Finished" on a Finish card; on a Progress card the milestone
 * ("Halfway there") or the episode ("S1 · E8"); "My week" on a recap.
 */
export function useHeadline(data: CardData): string {
  const t = useTranslations("Card");
  if (data.recap) return t("recapHeadline", { period: data.recap.period ?? "week" });
  if (!data.progress) return t("finished");
  const { milestone, season, episode } = data.progress;
  return milestone ? t("milestone", { milestone }) : t("episodeCode", { season, episode });
}

/** Brand footer on every card (growth loop): Stonie + `mystonie · @username` + the site. No QR. */
export function CardFooter({ host, username, className }: { host: string; username?: string | null; className?: string }) {
  const t = useTranslations("Card");
  return (
    <div className={cn("flex min-w-0 items-center gap-[16px] text-[32px]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG */}
      <img src="/icon.svg" alt="" width={60} height={60} />
      <span className={cn(DISPLAY, "shrink-0 text-[40px] font-extrabold tracking-[-0.02em]")}>{t("brand")}</span>
      {username && <span className="min-w-0 truncate opacity-80">{t("byUser", { username })}</span>}
      <span className="ml-auto shrink-0 opacity-70">{host}</span>
    </div>
  );
}

/** Footer props from the card data: the username unless the user hid it. */
export const footerUser = (data: CardData) => (data.hide?.includes("username") ? null : data.username);

/** Rubber "FINISHED" stamp (the collectible moment), optionally with the date. */
export function FinishedStamp({ date, className }: { date?: string; className?: string }) {
  const t = useTranslations("Card");
  return (
    <div
      className={cn(
        "rounded-[18px] border-[6px] border-current p-[6px] text-[var(--card-stamp)]",
        className,
      )}
    >
      <div className="flex flex-col items-center rounded-[10px] border-[2px] border-current px-[26px] py-[10px]">
        <span className={cn(DISPLAY, "text-[46px] leading-none font-extrabold tracking-[0.1em] uppercase")}>{t("finished")}</span>
        {date && <span className="mt-[6px] text-[24px] font-bold tracking-[0.12em] whitespace-nowrap uppercase">{date}</span>}
      </div>
    </div>
  );
}
