import { useFormatter, useTranslations } from "next-intl";
import { cardImageUrl } from "@/core/catalog/images";
import { titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, useHeadline, useRecapRange, useStats, type TemplateProps } from "../parts";

// The festival's name ("MY WEEK"), as big as its length allows.
const NAME_SIZES = {
  story: ["text-[220px]", "text-[150px]", "text-[112px]", "text-[90px]"],
  feed: ["text-[164px]", "text-[116px]", "text-[88px]", "text-[70px]"],
} as const;

// The headliner: the period's most watched title, top of the bill.
const HEADLINER_SIZES = {
  story: ["text-[150px]", "text-[118px]", "text-[92px]", "text-[74px]"],
  feed: ["text-[112px]", "text-[88px]", "text-[70px]", "text-[56px]"],
} as const;

/** The headliner's poster as a duotone print: its darks in black, its lights in a light tint of the card's accent. */
function Duotone({ url, className }: { url?: string | null; className?: string }) {
  return (
    <div className={cn("overflow-hidden", className)} style={{ background: "color-mix(in oklab, var(--card-accent) 74%, #fff)" }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- exported to PNG; must be a plain CORS image
        <img
          src={cardImageUrl(url)}
          alt=""
          crossOrigin="anonymous"
          onError={(e) => (e.currentTarget.style.display = "none")}
          className="size-full object-cover object-[50%_10%] mix-blend-multiply brightness-[1.3] contrast-[1.35] grayscale"
        />
      )}
    </div>
  );
}

/**
 * Pro (ADR 0084): the period as a festival poster. The headliner's poster is printed in duotone with a halftone screen,
 * the festival's name is the period ("MY WEEK") in giant condensed caps, its dates on a sticker, then the bill: the
 * most watched title as the headliner, the others under it, favourites and the year's standouts in the fine print.
 * The numbers are printed on a ticket stub. Weekly and monthly recaps, stats cards and Year in Review.
 */
export function LineupCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const headline = useHeadline(data);
  const range = useRecapRange(data.recap);
  const stats = useStats(data);
  const recap = data.recap;
  const story = size === "story";
  const titles = recap?.titles.length ? recap.titles : [{ name: data.name, kind: data.kind, posterUrl: data.posterUrl ?? null }];
  const [headliner, ...acts] = titles;
  const more = recap ? Math.max(0, recap.titleCount - titles.length) : 0;
  const bill = [...acts.map((a) => a.name), ...(more > 0 ? [t("lineupMore", { count: more })] : [])].join(" • ");
  const highlights = recap?.highlights ?? {};
  // The fine print: favourite people (stats cards and Year in Review), then the year's standouts.
  const notes = [
    ...(recap?.favourites ?? []).map((f) => ({ label: t("favourite", { role: f.role }), value: f.name })),
    highlights.genre ? { label: t("topGenre"), value: highlights.genre } : null,
    highlights.month
      ? { label: t("busiestMonth"), value: format.dateTime(new Date(`${highlights.month}-01T00:00:00Z`), { month: "long", timeZone: "UTC" }) }
      : null,
    highlights.streak ? { label: t("bestStreak"), value: t("streakDays", { count: highlights.streak }) } : null,
  ].filter((n): n is { label: string; value: string } => !!n);
  const longest = Math.max(0, ...stats.map((s) => s.value.length));
  const figure = longest <= 3 ? (story ? "text-[108px]" : "text-[84px]") : longest <= 5 ? (story ? "text-[84px]" : "text-[66px]") : story ? "text-[66px]" : "text-[54px]";
  const art = story ? "h-[1160px]" : "h-[740px]";

  return (
    <CardRoot size={size} palette={palette} className={cn("px-[72px] pt-[84px] pb-[60px]", story ? "gap-[28px]" : "gap-[18px]")}>
      {/* The print: duotone poster, halftone screen, and a fade into the card's own colour. */}
      <Duotone url={headliner?.posterUrl} className={cn("absolute inset-x-0 top-0", art)} />
      <div className={cn("absolute inset-x-0 top-0 bg-[radial-gradient(circle,rgba(0,0,0,0.3)_1.6px,transparent_2.3px)] bg-[length:14px_14px]", art)} />
      <div className={cn("absolute inset-x-0 top-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.5)_0%,rgba(0,0,0,0.12)_30%,transparent_42%,transparent_54%,var(--card-bg)_100%)]", art)} />

      <header className={cn("relative flex flex-col items-start", story ? "gap-[30px]" : "gap-[20px]")}>
        <p
          data-fit=""
          className={cn(
            DISPLAY,
            "line-clamp-2 w-full font-extrabold tracking-[-0.01em] text-white uppercase [font-stretch:75%] [overflow-wrap:anywhere] [text-shadow:0_6px_40px_rgb(0_0_0/0.45)]",
            NAME_SIZES[size][titleSizeStep(headline)],
            "leading-[0.84]",
          )}
        >
          {headline}
        </p>
        {/* The dates, on a sticker slapped across the print. */}
        <div className="relative max-w-full rotate-[-2.5deg] bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[0_12px_28px_rgba(0,0,0,0.35)]">
          <span className="absolute -top-[16px] left-[28px] h-[34px] w-[110px] rotate-[-6deg] bg-[var(--card-accent)] opacity-70" />
          <p className={cn(DISPLAY, "truncate font-extrabold tracking-[0.04em] uppercase", story ? "px-[34px] py-[14px] text-[52px]" : "px-[26px] py-[10px] text-[40px]", "leading-[1.1]")}>
            {range}
          </p>
        </div>
      </header>

      {/* The print shows through here. */}
      <div className="min-h-0 flex-1" />

      {/* The bill: the headliner, then everyone else, then the fine print. */}
      <section className={cn("relative flex flex-col", story ? "gap-[18px]" : "gap-[10px]")}>
        <h2
          data-fit=""
          className={cn(
            DISPLAY,
            "line-clamp-2 font-extrabold tracking-[-0.01em] uppercase [font-stretch:75%] [overflow-wrap:anywhere]",
            HEADLINER_SIZES[size][titleSizeStep(headliner?.name ?? "")],
            "leading-[0.9]",
          )}
        >
          {headliner?.name}
        </h2>
        {bill && (
          <p
            data-fit=""
            className={cn(
              DISPLAY,
              "font-bold text-[var(--card-muted)] uppercase [font-stretch:75%] [overflow-wrap:anywhere]",
              story ? "line-clamp-3 text-[58px]/[1.08]" : "line-clamp-2 text-[44px]/[1.06]",
            )}
          >
            {bill}
          </p>
        )}
        {notes.length > 0 && (
          <p className={cn("[overflow-wrap:anywhere]", story ? "line-clamp-3 text-[32px]/[1.35]" : "line-clamp-2 text-[27px]/[1.3]")}>
            {notes.map((n, i) => (
              <span key={n.label}>
                {i > 0 && " · "}
                <span className="text-[var(--card-muted)]">{n.label}</span> <span className="font-bold">{n.value}</span>
              </span>
            ))}
          </p>
        )}
      </section>

      {/* The ticket stub: Stonie on the tear-off, the numbers on the ticket. */}
      {stats.length > 0 && (
        <div className="relative flex w-full shrink-0 rotate-[-1.2deg] bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[0_22px_50px_rgba(0,0,0,0.45)]">
          <span className="absolute top-1/2 -left-[26px] size-[52px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <span className="absolute top-1/2 -right-[26px] size-[52px] -translate-y-1/2 rounded-full bg-[var(--card-bg)]" />
          <div className={cn("flex shrink-0 items-center justify-center border-r-[5px] border-dashed border-[var(--card-ink)]/25", story ? "w-[132px]" : "w-[112px]")}>
            {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG */}
            <img src="/icon.svg" alt="" className={cn("-rotate-90", story ? "size-[76px]" : "size-[62px]")} />
          </div>
          <div className={cn("flex min-w-0 flex-1 flex-col", story ? "gap-[12px] px-[40px] py-[26px]" : "gap-[8px] px-[32px] py-[18px]")}>
            <p className={cn("flex min-w-0 justify-between gap-[20px] font-bold tracking-[0.16em] uppercase opacity-60 [&:lang(th)]:tracking-normal", story ? "text-[24px]" : "text-[20px]")}>
              <span className="shrink-0">{t("admitOne")}</span>
              {recap && <span className="min-w-0 truncate">{t("titlesWatched", { count: recap.titleCount, period: recap.period ?? "week" })}</span>}
            </p>
            <dl className="grid gap-[24px]" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
              {stats.map((s) => (
                <div key={s.label} className="min-w-0">
                  <dd data-fit="" className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", figure, "leading-[0.9]")}>
                    {s.value}
                  </dd>
                  <dt className={cn("mt-[8px] truncate font-bold tracking-[0.12em] uppercase opacity-65 [&:lang(th)]:tracking-normal", story ? "text-[24px]" : "text-[20px]")}>
                    {s.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative shrink-0" />
    </CardRoot>
  );
}
