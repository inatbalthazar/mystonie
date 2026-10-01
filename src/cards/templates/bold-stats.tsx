import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, footerUser, CardTitle, DISPLAY, FinisherStamp, Poster, Review, Stars, useFinishedDate, useHeadline, useStats, type TemplateProps } from "../parts";

/** Strava-style: huge condensed numbers, a strip of poster, the title. Best for series, progress and recaps. */
export function BoldStatsCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const format = useFormatter();
  const date = useFinishedDate(data);
  const stats = useStats(data);
  const headline = useHeadline(data);
  const story = size === "story";
  const longest = Math.max(0, ...stats.map((s) => s.value.length));
  const numberSize =
    longest <= 3 ? (story ? "text-[176px]" : "text-[140px]") : longest <= 5 ? (story ? "text-[120px]" : "text-[100px]") : "text-[80px]";

  return (
    <CardRoot size={size} palette={palette} className="p-[80px]">
      <Poster url={data.posterUrl} className={cn("absolute inset-x-0 top-0 opacity-50", story ? "h-[800px]" : "h-[440px]")} />
      <div className={cn("absolute inset-x-0 top-0 bg-gradient-to-b from-transparent to-[var(--card-bg)]", story ? "h-[800px]" : "h-[440px]")} />

      <div className="relative flex min-h-0 flex-1 flex-col gap-[28px]">
        <p className="flex items-center gap-[16px] text-[36px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase">
          <span className="size-[20px] shrink-0 rounded-full bg-current" />
          <span className="truncate">{headline}</span>
        </p>
        <FinisherStamp
          data={data}
          className={cn("absolute right-0 rotate-[8deg]", story ? "top-[100px]" : "-top-[24px] origin-top-right scale-[0.7]")}
        />
        <div className={story ? "mt-[320px]" : "mt-[80px]"}>
          <CardTitle data={data} size={size} className={story ? "" : "line-clamp-2"} />
        </div>
        {data.recap ? (
          // A week: which titles, rather than one title's facts. Stats cards add their favourites (stage 4).
          <>
            <p className="line-clamp-2 text-[34px] text-[var(--card-muted)]">
              {t("titlesWatched", { count: data.recap.titleCount, period: data.recap.period ?? "week" })}
              {" · "}
              {data.recap.titles.map((title) => title.name).join(", ")}
            </p>
            {data.recap.favourites && (
              <p className="line-clamp-2 text-[34px]">
                {data.recap.favourites.map((f, i) => (
                  <span key={f.role}>
                    {i > 0 && " · "}
                    <span className="text-[var(--card-muted)]">{t("favourite", { role: f.role })}</span>{" "}
                    <span className="font-bold">{f.name}</span>
                  </span>
                ))}
              </p>
            )}
          </>
        ) : data.challenge ? (
          // A challenge: its month, and the title that completed it.
          <p className="line-clamp-2 text-[34px] text-[var(--card-muted)]">
            {format.dateTime(new Date(`${data.challenge.month}-01T00:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" })}
            {" · "}
            {t("challengeBy", { name: data.name })}
          </p>
        ) : (
          <p className="text-[34px] text-[var(--card-muted)]">
            {t("kind", { kind: data.kind })}
            {data.year ? ` · ${data.year}` : ""}
            {data.progress?.milestone ? ` · ${t("episodeCode", { season: data.progress.season, episode: data.progress.episode })}` : ""}
            {data.reading?.milestone ? ` · ${t("readingHeadline", { unit: data.reading.unit, position: format.number(data.reading.position) })}` : ""}
            {" · "}
            {date}
          </p>
        )}

        <dl
          className={cn(
            "mt-auto grid gap-[32px] border-t-[4px] border-[var(--card-text)]/20 pt-[36px]",
            // One number (a milestone) gets the whole row, so its label isn't cut.
            stats.length === 1 ? "grid-cols-1" : "grid-cols-3",
          )}
        >
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd
                data-fit=""
                className={cn(DISPLAY, "font-extrabold tracking-[-0.03em] whitespace-nowrap [font-stretch:75%]", numberSize, "leading-[0.9]")}
              >
                {s.value}
              </dd>
              <dt className="mt-[10px] truncate text-[30px] tracking-[0.12em] text-[var(--card-muted)] uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>
        {(data.rating || data.review) && (
          <div className="flex flex-col gap-[20px] border-t-[4px] border-[var(--card-text)]/15 pt-[32px]">
            <Stars rating={data.rating} className="text-[60px] text-[var(--card-accent)]" />
            <Review text={data.review} className={cn("text-[42px] leading-snug", story ? "" : "line-clamp-2")} />
          </div>
        )}
      </div>
      <CardFooter host={host} username={footerUser(data)} className="relative mt-[48px] shrink-0" />
    </CardRoot>
  );
}
