// Building blocks shared by card templates. Cards are laid out at export size (1080px wide)
// in real pixels; previews scale the whole card with CSS (see card-preview.tsx).
import { StarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { CARD_DIMENSIONS, type CardData, type CardSize, type Palette } from "@/core/cards/types";
import { titleSizeStep, watchMinutes } from "@/core/cards/text";
import { cn } from "@/lib/utils";

export type TemplateProps = { data: CardData; size: CardSize; palette: Palette; host: string };

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
    fontFamily:
      "var(--font-sans), var(--font-noto-thai), var(--font-noto-kr), var(--font-noto-jp), ui-sans-serif, sans-serif",
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

/** Card headline, shrinking by length and clamped to 3 lines so nothing overflows. */
export function CardTitle({ data, size, className }: { data: CardData; size: CardSize; className?: string }) {
  return (
    <h2
      data-fit=""
      className={cn(
        "line-clamp-3 font-bold leading-[1.05] tracking-tight [overflow-wrap:anywhere]",
        TITLE_SIZES[size][titleSizeStep(data.name)],
        className,
      )}
    >
      {data.name}
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

/** Stat blocks a template can show: watch time, episodes, seasons (only the known ones). */
export function useStats(data: CardData): { value: string; label: string }[] {
  const t = useTranslations("Card");
  const format = useFormatter();
  const stats: { value: string; label: string }[] = [];
  const minutes = watchMinutes(data);
  if (minutes) {
    stats.push(
      // A movie's runtime reads best in minutes ("133 min"); a series' total in hours.
      data.kind === "series" && minutes >= 120
        ? { value: format.number(Math.round(minutes / 60)), label: t("hours") }
        : { value: format.number(minutes), label: t("minutes") },
    );
  }
  if (data.kind === "series" && data.episodeCount) {
    stats.push({ value: format.number(data.episodeCount), label: t("episodes", { count: data.episodeCount }) });
  }
  if (data.kind === "series" && data.seasonCount) {
    stats.push({ value: format.number(data.seasonCount), label: t("seasons", { count: data.seasonCount }) });
  }
  return stats;
}

/** Brand footer on every card (growth loop): Stonie + name + short link. No QR. */
export function CardFooter({ host, className }: { host: string; className?: string }) {
  const t = useTranslations("Card");
  return (
    <div className={cn("flex items-center gap-4 text-[34px]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG */}
      <img src="/icon.svg" alt="" width={56} height={56} />
      <span className="font-semibold">{t("brand")}</span>
      <span className="opacity-70">{host}</span>
    </div>
  );
}
