import { useTranslations } from "next-intl";
import { finishedKey, titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { GOLD_INK } from "../gold";
import { CardFooter, CardRoot, FinisherStamp, footerUser, Poster, Stars, useCardName, useFinishedDate, useHeadline, useStats, type TemplateProps } from "../parts";

/** The book face (Cormorant Garamond), with the cards' Noto fallbacks. */
const SERIF = "[font-family:var(--card-serif)]";

// A classical title, stamped large: steps by length, like every card's.
const TITLE_SIZES = {
  story: ["text-[124px]", "text-[100px]", "text-[80px]", "text-[64px]"],
  feed: ["text-[96px]", "text-[78px]", "text-[62px]", "text-[50px]"],
} as const;

// Foil pressed into cloth: the top edge catches the light, the rest sits a little below the board.
const STAMPED = "0 1px 0 rgba(255, 244, 214, 0.35), 0 -1px 0 rgba(0, 0, 0, 0.5), 0 3px 8px rgba(0, 0, 0, 0.35)";

/** One corner of the gilt frame (drawn for the top left; the others turn it): a bracket, a curl and a stud. */
function Corner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("absolute size-[100px]", className)} fill="none" stroke={GOLD_INK} strokeLinecap="round">
      <path d="M6 70V6h64" strokeWidth="3" />
      <path d="M18 50V18h32" strokeWidth="2" />
      <path d="M70 6c12 0 16 8 13 14s-11 6-12 0" strokeWidth="2.5" />
      <path d="M6 70c0 12 8 16 14 13s6-11 0-12" strokeWidth="2.5" />
      <circle cx="31" cy="31" r="5.5" fill={GOLD_INK} stroke="none" />
    </svg>
  );
}

/** The gilt rule under the title: two lines and a lozenge between them. */
function Rule({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 28" aria-hidden="true" className={cn("relative shrink-0", className)} fill="none" stroke={GOLD_INK} strokeLinecap="round">
      <path d="M8 14h164M248 14h164" strokeWidth="2" />
      <path d="M180 14c8-9 16-9 22 0M240 14c-8-9-16-9-22 0" strokeWidth="2" />
      <path d="M210 2l11 12-11 12-11-12z" fill={GOLD_INK} stroke="none" />
    </svg>
  );
}

/** A cover-less plate's medallion: a gilt ring around a lozenge, like the stamp on a plain cloth board. */
function Medallion({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className} fill="none" stroke={GOLD_INK}>
      <circle cx="100" cy="100" r="92" strokeWidth="4" />
      <circle cx="100" cy="100" r="78" strokeWidth="1.5" />
      <path d="M100 38l34 62-34 62-34-62z" strokeWidth="3" />
      <path d="M100 66l16 34-16 34-16-34z" fill={GOLD_INK} stroke="none" />
    </svg>
  );
}

/**
 * Pro (ADR 0084): a collector's clothbound edition. The whole card is the cover, cloth in the cover's own colour with
 * its weave, a gilt frame and corners, the title stamped in gold, and the cover art tipped into a gilt-ruled plate. An
 * Ex libris bookplate is pasted at the foot with the owner's name, the review written in as an inscription, and the
 * numbers. Books and manga, Finish and reading Progress; a book still being read has its ribbon marker out.
 */
export function GildedCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const headline = useHeadline(data);
  const name = useCardName(data);
  const stats = useStats(data);
  const { username, avatarUrl } = footerUser(data);
  const story = size === "story";
  // "Finished · 20 Sep 2026", or where the reader is ("Halfway there · 27 Sep 2026").
  const imprint = `${data.reading ? headline : t(finishedKey(data.kind))} · ${date}`;
  const numbers = stats.map((s) => `${s.value} ${s.label}`).join(" · ");
  const plate = !!(username || data.review || numbers);

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center px-[128px]", story ? "gap-[30px] pt-[150px] pb-[100px]" : "gap-[18px] pt-[120px] pb-[86px]")}>
      {/* The cloth: the cover's colour, deepened, with its weave; light across the board and the spine's shadow. */}
      {/* The cover's colour, deepened so the gold reads on it whatever the cover (a yellow cover's olive too). */}
      <div className="absolute inset-0" style={{ background: "color-mix(in oklab, var(--card-bg) 64%, #000)" }} />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.035)_0_2px,transparent_2px_6px),repeating-linear-gradient(90deg,rgba(0,0,0,0.13)_0_2px,transparent_2px_6px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_38%_22%,rgba(255,255,255,0.08),transparent_70%),linear-gradient(90deg,rgba(0,0,0,0.5),transparent_7%,transparent_94%,rgba(0,0,0,0.25))]" />

      {/* The gilt frame: a heavy rule, a fine one inside it, and the corners. */}
      <div className="pointer-events-none absolute inset-[44px] border-[3px]" style={{ borderColor: GOLD_INK }}>
        <div className="absolute inset-[11px] border-[1.5px]" style={{ borderColor: GOLD_INK }} />
        <Corner className="top-[4px] left-[4px]" />
        <Corner className="top-[4px] right-[4px] rotate-90" />
        <Corner className="right-[4px] bottom-[4px] rotate-180" />
        <Corner className="bottom-[4px] left-[4px] -rotate-90" />
      </div>

      {/* Still being read: the ribbon marker hangs over the frame from the head of the book. */}
      {data.reading && (
        <span
          className={cn(
            "absolute top-0 right-[168px] w-[58px] bg-[linear-gradient(90deg,#6f0f1c,#b8293c_46%,#7e1322)] shadow-[5px_8px_18px_rgba(0,0,0,0.45)] [clip-path:polygon(0_0,100%_0,100%_100%,50%_84%,0_100%)]",
            story ? "h-[134px]" : "h-[106px]",
          )}
        />
      )}

      <h2
        data-fit=""
        className={cn(SERIF, "relative w-full text-center font-bold [overflow-wrap:anywhere]", story ? "line-clamp-3" : "line-clamp-2", TITLE_SIZES[size][titleSizeStep(name)], "leading-[1.02]")}
        style={{ color: GOLD_INK, textShadow: STAMPED }}
      >
        {name}
      </h2>
      <Rule className={story ? "h-[28px] w-[420px]" : "h-[22px] w-[330px]"} />

      {/* The cover, tipped into a recessed plate ruled in gold. It takes the height the rest leaves. */}
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <div
          className="relative h-full border-[3px] bg-black/20 p-[14px] shadow-[inset_0_8px_18px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.08)]"
          style={{ borderColor: GOLD_INK }}
        >
          {data.posterUrl ? (
            <Poster url={data.posterUrl} className="aspect-[2/3] h-full shadow-[0_8px_20px_rgba(0,0,0,0.5)]" />
          ) : (
            // No cover: plain cloth, stamped with a medallion.
            <div className="flex aspect-[2/3] h-full items-center justify-center bg-black/25 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]">
              <Medallion className="w-[56%]" />
            </div>
          )}
          <FinisherStamp
            data={data}
            className={cn("absolute rotate-[-10deg]", story ? "-top-[24px] -left-[132px]" : "-top-[18px] -left-[104px] origin-top-left scale-[0.7]")}
          />
        </div>
      </div>

      {/* The imprint, stamped like the title, with the stars. */}
      <div className={cn("relative flex max-w-full shrink-0 items-center gap-[28px]", story ? "flex-col gap-[14px]" : "")}>
        <p
          className={cn(SERIF, "min-w-0 truncate font-bold tracking-[0.22em] uppercase [&:lang(th)]:tracking-normal", story ? "text-[36px]" : "text-[30px]")}
          style={{ color: GOLD_INK, textShadow: STAMPED }}
        >
          {imprint}
        </p>
        <Stars rating={data.rating} className={cn("shrink-0 text-[#e4c272]", story ? "text-[52px]" : "text-[42px]")} />
      </div>

      {/* The bookplate, pasted in at the foot: whose book it is, the inscription and the numbers. */}
      {plate && (
        <div className="relative w-full shrink-0 rotate-[-1deg] bg-[var(--card-paper)] p-[12px] text-[var(--card-ink)] shadow-[0_16px_34px_rgba(0,0,0,0.45)]">
          <div className={cn("flex flex-col items-center border-[6px] border-double border-[var(--card-ink)]/55 text-center", story ? "gap-[10px] px-[40px] py-[24px]" : "gap-[6px] px-[32px] py-[16px]")}>
            <p className={cn(SERIF, "max-w-full truncate font-bold", story ? "text-[30px]" : "text-[26px]")}>
              <span className="tracking-[0.24em] uppercase [&:lang(th)]:tracking-normal">{t("exLibris")}</span>
              {/* The owner's name as they write it, not in capitals. */}
              {username && <span className="tracking-[0.04em]"> {t("byUser", { username })}</span>}
            </p>
            {data.review && (
              <p
                data-fit=""
                className={cn(
                  // Side padding keeps script glyph overhang inside the box (clamped text must not scroll).
                  // Written from the left like an inscription (centred, the clamp's "…" lands past the box's edge); the
                  // paragraph keeps its own width, so a short one still sits in the middle of the plate.
                  "max-w-full px-[20px] text-left [overflow-wrap:anywhere] [font-family:var(--card-hand)]",
                  story ? "line-clamp-2 text-[54px]/[1.12]" : "line-clamp-1 text-[46px]/[1.12]",
                )}
              >
                {data.review}
              </p>
            )}
            {numbers && (
              <p className={cn(SERIF, "max-w-full truncate font-bold tracking-[0.14em] uppercase opacity-75 [&:lang(th)]:tracking-normal", story ? "text-[30px]" : "text-[26px]")}>
                {numbers}
              </p>
            )}
          </div>
        </div>
      )}

      <CardFooter host={host} username={username} avatarUrl={avatarUrl} className="relative w-full shrink-0 px-[24px]" />
    </CardRoot>
  );
}
