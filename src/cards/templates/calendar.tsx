import { useFormatter, useTranslations } from "next-intl";
import { ChallengePatch } from "@/components/challenges/patch";
import { isChallengeSlug } from "@/core/challenges";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, footerUser, Poster, useCardName, useHeadline, useStats, type TemplateProps } from "../parts";

/** Monday first: the weekday column of a day (0 = Monday … 6 = Sunday). */
const column = (y: number, m: number, d: number) => (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;

/**
 * A completed monthly challenge (S3 challenges & clubs): the month's page torn off a wall calendar, with every day
 * something was logged circled in stamp ink, the challenge's embroidered patch sewn onto the corner, and the title
 * that completed it pasted in.
 */
export function CalendarCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const headline = useHeadline(data);
  const name = useCardName(data);
  const [stat] = useStats(data);
  const story = size === "story";
  const challenge = data.challenge;
  const [y, m] = (challenge?.month ?? data.finishedOn.slice(0, 7)).split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = column(y, m, 1);
  const circled = new Set(challenge?.days ?? []);
  const month = format.dateTime(new Date(Date.UTC(y, m - 1, 1)), { month: "long", timeZone: "UTC" });
  // 2024-01-01 was a Monday: its week gives the weekday initials in the card's locale.
  const weekdays = Array.from({ length: 7 }, (_, i) => format.dateTime(new Date(Date.UTC(2024, 0, 1 + i)), { weekday: "narrow", timeZone: "UTC" }));
  const cells = [...Array.from({ length: lead }, () => 0), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const rows = Math.ceil(cells.length / 7);
  const cell = story ? (rows > 5 ? "h-[92px]" : "h-[108px]") : rows > 5 ? "h-[64px]" : "h-[76px]";
  const dayText = story ? "text-[44px]" : "text-[34px]";

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center px-[72px] pb-[64px]", story ? "gap-[40px] pt-[96px]" : "gap-[24px] pt-[56px]")}>
      {/* The headline, stamped above the page. */}
      <div className="max-w-full rotate-[-3deg] rounded-[16px] border-[6px] border-current px-[32px] py-[10px] text-[var(--card-text)]">
        <p className={cn(DISPLAY, "truncate text-[50px] leading-none font-extrabold tracking-[0.08em] uppercase [&:lang(th)]:tracking-normal")}>{headline}</p>
      </div>

      {/* The calendar page: rings along the top, the month, the grid. */}
      <div className={cn("relative w-full shrink-0 rotate-[-1.5deg] bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[0_30px_60px_rgba(0,0,0,0.45)]", story ? "px-[48px] pt-[64px] pb-[40px]" : "px-[40px] pt-[48px] pb-[28px]")}>
        <div className="absolute inset-x-[60px] -top-[22px] flex justify-between">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="h-[52px] w-[18px] rounded-full bg-[linear-gradient(90deg,#8d8d8d,#e9e9e9_45%,#7a7a7a)] shadow-[0_4px_6px_rgba(0,0,0,0.35)]" />
          ))}
        </div>
        <div className="flex items-baseline justify-between gap-[24px] border-b-[4px] border-current pb-[16px]">
          <p className={cn(DISPLAY, "min-w-0 truncate leading-none font-extrabold tracking-[-0.02em] uppercase [&:lang(th)]:tracking-normal", story ? "text-[96px]" : "text-[76px]")}>{month}</p>
          <p className={cn(DISPLAY, "shrink-0 leading-none font-bold opacity-70", story ? "text-[64px]" : "text-[50px]")}>{y}</p>
        </div>
        <div className="mt-[16px] grid grid-cols-7 text-center">
          {weekdays.map((w, i) => (
            <span key={i} className={cn("font-bold opacity-60", story ? "text-[30px]" : "text-[24px]")}>
              {w}
            </span>
          ))}
          {cells.map((day, i) => (
            <span key={i} className={cn("relative flex items-center justify-center", cell)}>
              {day > 0 && (
                <>
                  <span className={cn(DISPLAY, dayText, "font-bold tabular-nums", circled.has(day) ? "text-[var(--card-stamp)]" : "opacity-55")}>{day}</span>
                  {circled.has(day) && (
                    // A hand-drawn ring in stamp ink, each one a little different.
                    <span
                      className={cn(
                        "absolute rounded-[50%] border-[5px] border-[var(--card-stamp)]",
                        story ? "size-[86px]" : "size-[62px]",
                        ["rotate-[-8deg]", "rotate-[6deg]", "rotate-[-2deg]", "rotate-[11deg]"][day % 4],
                      )}
                    />
                  )}
                </>
              )}
            </span>
          ))}
        </div>
        {challenge && isChallengeSlug(challenge.slug) && (
          <ChallengePatch
            slug={challenge.slug}
            size={story ? 230 : 170}
            // A paper edge, so a dark patch still reads on a dark card.
            className={cn("absolute rotate-[12deg] outline-[8px] outline-[var(--card-paper)] outline-solid", story ? "-right-[44px] -bottom-[96px]" : "-right-[36px] -bottom-[64px]")} />
        )}
      </div>

      {/* What was done, and the title that did it, pasted in. */}
      <div className="flex w-full min-w-0 flex-1 items-center gap-[36px] px-[8px]">
        <figure className={cn("relative shrink-0 rotate-[-4deg] bg-[var(--card-paper)] p-[12px] shadow-[0_16px_36px_rgba(0,0,0,0.35)]", story ? "w-[200px]" : "w-[132px]")}>
          <span className="absolute -top-[18px] left-1/2 z-10 h-[38px] w-[110px] -translate-x-1/2 rotate-[-5deg] bg-[var(--card-accent)] opacity-70" />
          <Poster url={data.posterUrl} className="aspect-[2/3] w-full" />
        </figure>
        <div className="flex min-w-0 flex-col gap-[8px] pr-[120px]">
          <p data-fit="" className={cn(DISPLAY, "line-clamp-2 leading-[1.02] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere]", story ? "text-[84px]" : "text-[64px]")}>
            {name}
          </p>
          {stat && (
            <p className={cn("truncate font-bold tracking-[0.1em] text-[var(--card-muted)] uppercase [&:lang(th)]:tracking-normal", story ? "text-[36px]" : "text-[30px]")}>
              {stat.value} {stat.label}
            </p>
          )}
          <p className={cn("line-clamp-2 [overflow-wrap:anywhere] [font-family:var(--card-hand)] leading-[1.1]", story ? "text-[52px]" : "text-[42px]")}>
            {t("challengeBy", { name: data.name })}
          </p>
        </div>
      </div>

      <CardFooter host={host} username={footerUser(data)} className="w-full shrink-0" />
    </CardRoot>
  );
}
