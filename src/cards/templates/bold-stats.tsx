import { useTranslations } from "next-intl";
import { CardFooter, CardRoot, CardTitle, Poster, Review, Stars, useFinishedDate, useStats, type TemplateProps } from "../parts";

/** Strava-style: huge numbers, a strip of poster, the title. Best for series and recaps. */
export function BoldStatsCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const stats = useStats(data);
  const story = size === "story";
  const longest = Math.max(0, ...stats.map((s) => s.value.length));
  const numberSize =
    longest <= 3 ? (story ? "text-[150px]" : "text-[120px]") : longest <= 5 ? (story ? "text-[104px]" : "text-[88px]") : "text-[72px]";

  return (
    <CardRoot size={size} palette={palette} className="p-[80px]">
      <Poster url={data.posterUrl} className={"absolute inset-x-0 top-0 opacity-45 " + (story ? "h-[760px]" : "h-[420px]")} />
      <div className={"absolute inset-x-0 top-0 bg-gradient-to-b from-transparent to-[var(--card-bg)] " + (story ? "h-[760px]" : "h-[420px]")} />

      <div className="relative flex min-h-0 flex-1 flex-col gap-[32px]">
        <p className="text-[40px] font-bold tracking-[0.25em] text-[var(--card-accent)] uppercase">{t("finished")}</p>
        <div className={story ? "mt-[320px]" : "mt-[80px]"}>
          <CardTitle data={data} size={size} className={story ? "" : "line-clamp-2"} />
        </div>
        <p className="text-[36px] text-[var(--card-muted)]">
          {t("kind", { kind: data.kind })}
          {data.year ? ` · ${data.year}` : ""}
          {" · "}
          {date}
        </p>

        <dl className="mt-auto grid grid-cols-3 gap-[32px]">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dd data-fit="" className={"font-black leading-none tracking-tight whitespace-nowrap " + numberSize}>{s.value}</dd>
              <dt className="mt-[8px] truncate text-[32px] tracking-[0.12em] text-[var(--card-muted)] uppercase">{s.label}</dt>
            </div>
          ))}
        </dl>
        {(data.rating || data.review) && (
          <div className="flex flex-col gap-[20px] border-t-[4px] border-[var(--card-text)]/15 pt-[32px]">
            <Stars rating={data.rating} className="text-[60px] text-[var(--card-accent)]" />
            <Review text={data.review} className={"text-[42px] leading-snug " + (story ? "" : "line-clamp-2")} />
          </div>
        )}
      </div>
      <CardFooter host={host} className="relative mt-[48px] shrink-0" />
    </CardRoot>
  );
}
