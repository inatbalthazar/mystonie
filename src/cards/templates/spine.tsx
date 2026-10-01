import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  CardFooter,
  CardRoot,
  CardTitle,
  DISPLAY,
  FinishedStamp,
  FinisherStamp,
  footerUser,
  Poster,
  Review,
  Stars,
  useFinishedDate,
  useHeadline,
  useStats,
  type TemplateProps,
} from "../parts";

// Decorative neighbours on the shelf: height (share of the shelf), width and colour. The row fits 936px (story).
const LEFT_BOOKS = [
  { h: "h-[74%]", w: "w-[56px]", bg: "bg-[var(--card-surface)]" },
  { h: "h-[86%]", w: "w-[80px]", bg: "bg-[var(--card-accent)] opacity-80" },
  { h: "h-[68%]", w: "w-[48px]", bg: "bg-[var(--card-muted)] opacity-60" },
];

/**
 * A book spine on a shelf (S2 books & manga): the title printed down its spine, the cover facing out next to it,
 * a FINISHED stamp or a bookmark for where the reader is. For books and manga.
 */
export function SpineCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const stats = useStats(data).slice(0, 3);
  const story = size === "story";
  const reading = data.reading;

  return (
    <CardRoot size={size} palette={palette} className="p-[72px]">
      {/* The wall: faint wallpaper stripes behind the shelf. */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_46px,rgba(255,255,255,0.035)_46px_92px)]" />

      <div className={cn("relative flex shrink-0 items-end gap-[14px] px-[8px]", story ? "h-[900px]" : "h-[500px]")}>
        {LEFT_BOOKS.map((b, i) => (
          <span key={i} className={cn("flex shrink-0 flex-col justify-between py-[28px] shadow-[inset_-8px_0_0_rgba(0,0,0,0.18)]", b.h, b.w, b.bg)}>
            <span className="h-[10px] bg-[var(--card-text)] opacity-25" />
            <span className="h-[10px] bg-[var(--card-text)] opacity-25" />
          </span>
        ))}

        {/* The spine: paper stock with the title printed down it and Stonie as the publisher's mark. */}
        <div
          className={cn(
            "relative flex h-[96%] shrink-0 flex-col items-center justify-between bg-[var(--card-paper)] text-[var(--card-ink)] shadow-[inset_-12px_0_0_rgba(0,0,0,0.12),0_18px_40px_rgba(0,0,0,0.35)]",
            story ? "w-[190px] py-[36px]" : "w-[150px] py-[24px]",
          )}
        >
          {reading && (
            // A bookmark ribbon: this one is still being read.
            <span className="absolute -top-[70px] right-[18px] h-[110px] w-[44px] bg-[var(--card-stamp)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_82%,0_100%)]" />
          )}
          <span className="h-[18px] w-full shrink-0 bg-[var(--card-accent)]" />
          <span
            className={cn(
              DISPLAY,
              "min-h-0 flex-1 overflow-hidden py-[28px] font-extrabold text-ellipsis whitespace-nowrap [writing-mode:vertical-rl]",
              story ? "text-[76px]" : "text-[60px]",
              "leading-none",
            )}
          >
            {data.name}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- exported to PNG */}
          <img src="/icon.svg" alt="" className={cn("shrink-0", story ? "size-[72px]" : "size-[56px]")} />
          <span className="mt-[20px] h-[18px] w-full shrink-0 bg-[var(--card-accent)]" />
        </div>

        {/* The cover, face out and leaning a little. */}
        <Poster
          url={data.posterUrl}
          className={cn(
            "aspect-[2/3] shrink-0 origin-bottom-left rotate-[-3deg] shadow-[0_24px_50px_rgba(0,0,0,0.45)]",
            story ? "w-[400px]" : "w-[300px]",
          )}
        />
        <span className="h-[78%] w-[60px] shrink-0 origin-bottom-right rotate-[7deg] bg-[var(--card-surface)] shadow-[inset_-8px_0_0_rgba(0,0,0,0.18)]" />

        {reading ? (
          // Where the reader is, handwritten on a taped-up note.
          <div className="absolute top-[24px] right-[8px] max-w-[62%] rotate-[3deg] bg-[var(--card-paper)] px-[32px] pt-[20px] pb-[14px] text-[var(--card-ink)] shadow-[0_14px_30px_rgba(0,0,0,0.3)]">
            <span className="absolute -top-[22px] left-1/2 h-[44px] w-[150px] -translate-x-1/2 rotate-[-4deg] bg-[var(--card-accent)] opacity-70" />
            <p className={cn("truncate [font-family:var(--card-hand)]", story ? "text-[76px]" : "text-[60px]", "leading-[1.15]")}>{headline}</p>
          </div>
        ) : (
          <FinishedStamp
            kind={data.kind}
            date={date}
            className={cn("absolute top-[40px] right-[8px] rotate-[8deg] bg-[var(--card-paper)]", story ? "" : "origin-top-right scale-[0.85]")}
          />
        )}
        {!reading && (
          <FinisherStamp
            data={data}
            className={cn("absolute right-[40px] rotate-[-8deg]", story ? "top-[330px]" : "top-[236px] origin-top-right scale-[0.75]")}
          />
        )}
      </div>
      {/* The shelf board, edge to edge. */}
      <div className="relative -mx-[72px] h-[40px] shrink-0 bg-[var(--card-paper)] shadow-[0_22px_36px_rgba(0,0,0,0.4)]">
        <span className="absolute inset-x-0 bottom-0 h-[10px] bg-black/15" />
      </div>

      <div className={cn("relative flex min-h-0 flex-1 flex-col", story ? "gap-[24px] pt-[56px]" : "gap-[16px] pt-[36px]")}>
        <div className="flex items-center justify-between gap-[24px]">
          <p className="truncate text-[32px] font-semibold tracking-[0.2em] text-[var(--card-muted)] uppercase">
            {t("kind", { kind: data.kind })}
            {data.year ? ` · ${data.year}` : ""}
            {reading ? ` · ${date}` : ""}
          </p>
          <Stars rating={data.rating} className="shrink-0 text-[48px] text-[var(--card-stamp)]" />
        </div>
        <CardTitle data={data} size={size} className="line-clamp-2" />
        <Review text={data.review} className={cn("text-[40px] leading-snug text-[var(--card-muted)]", story ? "line-clamp-2" : "line-clamp-1")} />
        {stats.length > 0 && (
          <dl className="mt-auto grid grid-cols-3 gap-[24px] border-t-[4px] border-[var(--card-text)]/15 pt-[24px]">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0">
                <dd data-fit="" className={cn(DISPLAY, "font-extrabold whitespace-nowrap [font-stretch:75%]", story ? "text-[76px]" : "text-[64px]", "leading-none")}>
                  {s.value}
                </dd>
                <dt className="mt-[8px] truncate text-[26px] tracking-[0.15em] text-[var(--card-muted)] uppercase">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
      <CardFooter host={host} {...footerUser(data)} className="relative mt-[40px] shrink-0" />
    </CardRoot>
  );
}
