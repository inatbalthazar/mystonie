import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, Poster, footerUser, useRecapRange, useStats, type TemplateProps } from "../parts";

// Each pasted poster leans its own way, overlapping a little, like prints on a yearbook's cover.
const TILTS = ["rotate-[-6deg]", "rotate-[4deg]", "rotate-[-2deg]", "rotate-[7deg]"];

/**
 * Year in Review (S2 milestones & recaps): a yearbook cover with the year in huge type, the year's top posters
 * pasted across it, the big numbers, then the standouts (top genre, busiest month, best streak).
 */
export function YearbookCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const range = useRecapRange(data.recap);
  const stats = useStats(data);
  const recap = data.recap;
  const story = size === "story";
  const year = recap?.from.slice(0, 4) ?? "";
  const titles = recap?.titles ?? [];
  const highlights = recap?.highlights ?? {};
  const standouts = [
    highlights.genre && { label: t("topGenre"), value: highlights.genre },
    highlights.month && {
      label: t("busiestMonth"),
      value: format.dateTime(new Date(`${highlights.month}-01T00:00:00Z`), { month: "long", timeZone: "UTC" }),
    },
    highlights.streak && { label: t("bestStreak"), value: t("streakDays", { count: highlights.streak }) },
  ].filter((s): s is { label: string; value: string } => !!s);

  return (
    <CardRoot size={size} palette={palette} className={cn("p-[72px]", story ? "gap-[44px]" : "gap-[26px]")}>
      {/* Cloth-bound cover: a darker spine band down the left edge. */}
      <div className="absolute inset-y-0 left-0 w-[36px] bg-black/25" />
      <div className="absolute inset-y-0 left-[36px] w-[6px] bg-white/10" />

      <header className="relative flex flex-col gap-[8px] pl-[12px]">
        <p className="text-[34px] font-bold tracking-[0.3em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal">{t("yearInReview")}</p>
        <p className={cn(DISPLAY, "font-extrabold tracking-[-0.05em] [font-stretch:75%]", story ? "text-[300px]" : "text-[210px]", "leading-[0.82]")}>{year}</p>
        <p className="truncate text-[34px] text-[var(--card-muted)]">{range}</p>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {titles.map((title, i) => (
          <figure
            key={i}
            className={cn(
              "relative -mx-[14px] shrink-0 bg-[var(--card-paper)] p-[10px] shadow-[0_18px_40px_rgb(0_0_0/0.4)]",
              // Four posters, overlapping, fit the 936px row: 4 × (240 + 20) − 8 × 14.
              story ? "w-[240px]" : "w-[170px]",
              TILTS[i % TILTS.length],
            )}
          >
            <div className="relative aspect-[2/3] w-full">
              <Poster url={title.posterUrl} className="absolute inset-0" />
              {!title.posterUrl && (
                <p
                  className={cn(
                    DISPLAY,
                    "absolute inset-0 line-clamp-5 font-extrabold text-white [overflow-wrap:anywhere]",
                    story ? "p-[20px] text-[40px]" : "p-[12px] text-[26px]",
                    "leading-[1.1]",
                  )}
                >
                  {title.name}
                </p>
              )}
            </div>
          </figure>
        ))}
      </div>

      {stats.length > 0 && (
        <dl className={cn("relative grid gap-[32px] border-t-[4px] border-[var(--card-text)]/20 pt-[28px]", stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd data-fit="" className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", story ? "text-[128px]" : "text-[96px]", "leading-[0.9]")}>
                {s.value}
              </dd>
              <dt className="mt-[8px] truncate text-[28px] tracking-[0.12em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal">{s.label}</dt>
            </div>
          ))}
        </dl>
      )}

      {standouts.length > 0 && (
        <dl className="relative flex items-start gap-[24px]">
          {standouts.map((s) => (
            <div key={s.label} className="min-w-0 flex-1 rotate-[-1deg] rounded-[16px] bg-[var(--card-paper)] px-[24px] py-[18px] text-[var(--card-ink)] shadow-[0_10px_24px_rgba(0,0,0,0.25)] even:rotate-[1.5deg]">
              <dt className="truncate text-[24px] font-bold tracking-[0.12em] uppercase opacity-70 [&:lang(th)]:tracking-normal">{s.label}</dt>
              <dd className={cn("truncate [font-family:var(--card-hand)]", story ? "text-[56px]" : "text-[46px]", "leading-[1.15]")}>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <CardFooter host={host} username={footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
