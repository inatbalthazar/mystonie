import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { finishedKey, titleSizeStep } from "@/core/cards/text";
import { cn } from "@/lib/utils";
import { CardFooter, CardRoot, DISPLAY, FinisherStamp, footerUser, Poster, Stars, useCardName, useFinishedDate, useStats, type TemplateProps } from "../parts";

/** The arcade's pixel face (Press Start 2P), with the cards' Noto fallbacks. */
const PIXEL = "[font-family:var(--card-pixel)]";

// The arcade at night: fixed neon, whatever the key art's colours (the art brings its own on the screen).
const NIGHT = "#0c0820";
const PINK = "#ff3ea5";
const CYAN = "#2ee6ff";
const SUN = "linear-gradient(180deg, #ffe46b 0%, #ffa23d 40%, #ff3ea5 100%)";

// The cabinet's title, in the marquee: condensed caps, by length.
const TITLE_SIZES = {
  story: ["text-[112px]", "text-[90px]", "text-[72px]", "text-[58px]"],
  feed: ["text-[88px]", "text-[70px]", "text-[56px]", "text-[46px]"],
} as const;

// Stars over the city: a few fixed points of light.
const STARS =
  "radial-gradient(circle at 8% 14%, #fff 0 2px, transparent 3px), radial-gradient(circle at 22% 6%, #fff 0 1.5px, transparent 2.5px), " +
  "radial-gradient(circle at 37% 19%, #fff 0 2px, transparent 3px), radial-gradient(circle at 63% 8%, #fff 0 1.5px, transparent 2.5px), " +
  "radial-gradient(circle at 79% 17%, #fff 0 2px, transparent 3px), radial-gradient(circle at 93% 5%, #fff 0 1.5px, transparent 2.5px), " +
  "radial-gradient(circle at 52% 27%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 14% 31%, #fff 0 1.5px, transparent 2.5px)";

/** The floor: a neon grid running from the horizon toward you. */
function Grid({ className }: { className?: string }) {
  // Lines closer together toward the horizon (y = 0), further apart toward the viewer.
  const rows = [0, 6, 14, 25, 39, 57, 80, 108, 143, 186, 238, 300];
  const cols = Array.from({ length: 19 }, (_, i) => i - 9);
  return (
    <svg viewBox="0 0 1080 300" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <g stroke={PINK} strokeWidth="2.5" fill="none" opacity="0.85">
        {rows.map((y) => (
          <line key={y} x1="0" x2="1080" y1={y} y2={y} />
        ))}
        {cols.map((c) => (
          <line key={c} x1={540 + c * 34} y1="0" x2={540 + c * 230} y2="300" />
        ))}
      </g>
    </svg>
  );
}

/** One line of the high-score table: the label and a dotted leader, then the value. */
function ScoreRow({ label, big = false, story, children }: { label: string; big?: boolean; story: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-[18px]">
      <dt className={cn(PIXEL, "flex min-w-0 flex-1 items-center gap-[18px] uppercase", story ? "text-[24px]" : "text-[20px]", "leading-[1.4]")} style={{ color: CYAN }}>
        <span className="min-w-0 truncate">{label}</span>
        <span className="h-0 min-w-[32px] flex-1 border-b-[4px] border-dotted border-white/35" />
      </dt>
      <dd className={cn(PIXEL, "shrink-0 whitespace-nowrap text-white", big ? (story ? "text-[52px]" : "text-[42px]") : story ? "text-[30px]" : "text-[26px]", "leading-[1.4]")}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Pro (ADR 0084): game clear at the arcade. The game's title is lit in the cabinet's neon marquee, the key art plays on
 * a CRT (scanlines, the tube's vignette and glass) with GAME CLEAR! across it, a starry night and a neon grid floor
 * behind; a game without key art gets a sunset over the grid on the screen. Under the screen, a high-score table: the
 * hours, the rating and the day; then the review in an RPG dialogue box. For games, Finish cards.
 */
export function ArcadeCard({ data, size, palette, host }: TemplateProps) {
  const t = useTranslations("Card");
  const date = useFinishedDate(data);
  const name = useCardName(data);
  const [stat] = useStats(data);
  const story = size === "story";

  return (
    <CardRoot size={size} palette={palette} className={cn("items-center bg-[#0c0820] p-[72px] text-white", story ? "gap-[36px]" : "gap-[22px]")}>
      {/* Night sky with its stars, glowing toward the horizon, and the neon grid floor from there down. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0c0820_0%,#1b0b40_40%,#4a1068_60%,#0c0820_60.2%)]" />
      <div className="absolute inset-0" style={{ background: STARS }} />
      <div className="absolute inset-x-0 top-[60%] bottom-0">
        <Grid className="size-full [filter:drop-shadow(0_0_6px_#ff3ea5)]" />
        <span className="absolute inset-x-0 top-0 h-[30%] bg-[linear-gradient(180deg,#0c0820,transparent)]" />
        <span className="absolute inset-x-0 -top-[3px] h-[6px] bg-[#ff3ea5] shadow-[0_0_24px_8px_rgba(255,62,165,0.55)]" />
      </div>

      {/* The cabinet's marquee: the title, lit from inside. */}
      <div
        className={cn("relative w-full shrink-0 rounded-[30px] border-[5px] px-[44px] text-center", story ? "py-[34px]" : "py-[20px]")}
        style={{
          borderColor: CYAN,
          background: "linear-gradient(180deg, #2c1060, #150733)",
          boxShadow: "0 0 0 3px rgba(46, 230, 255, 0.25), 0 0 36px rgba(46, 230, 255, 0.55), inset 0 0 34px rgba(46, 230, 255, 0.3)",
        }}
      >
        <h2
          data-fit=""
          className={cn(DISPLAY, "line-clamp-2 font-extrabold uppercase [font-stretch:75%] [overflow-wrap:anywhere]", TITLE_SIZES[size][titleSizeStep(name)], "leading-[0.98]")}
          style={{ textShadow: `0 0 10px ${PINK}, 0 0 30px rgba(255, 62, 165, 0.7)` }}
        >
          {name}
        </h2>
      </div>

      {/* The CRT: the key art behind scanlines, the tube's vignette and its glass, GAME CLEAR! across it. */}
      <div className="relative flex min-h-0 w-full flex-1 flex-col rounded-[58px] bg-[linear-gradient(180deg,#27232f,#121017)] p-[30px] pb-[18px] shadow-[0_40px_90px_rgba(0,0,0,0.65),inset_0_4px_0_rgba(255,255,255,0.1),inset_0_-6px_0_rgba(0,0,0,0.5)]">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[38px] bg-black shadow-[inset_0_0_0_4px_rgba(0,0,0,0.85)]">
          {data.posterUrl ? (
            <Poster url={data.posterUrl} className="absolute inset-0" />
          ) : (
            // No key art: the screen plays a sunset over the grid instead.
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#1b0b40_0%,#4a1068_62%,#0c0820_62.5%)]">
              <div className="absolute top-[18%] left-1/2 aspect-square w-[46%] -translate-x-1/2 overflow-hidden rounded-full" style={{ background: SUN }}>
                <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `repeating-linear-gradient(180deg, transparent 0 18px, ${NIGHT} 18px 26px)` }} />
              </div>
              <div className="absolute inset-x-0 top-[62%] bottom-0 bg-[#0c0820]">
                <Grid className="size-full [filter:drop-shadow(0_0_5px_#ff3ea5)]" />
              </div>
            </div>
          )}
          <span className="absolute inset-0 bg-[repeating-linear-gradient(180deg,rgba(0,0,0,0.3)_0_3px,transparent_3px_6px)]" />
          <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(0,0,0,0.7))]" />
          <span className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.17),transparent_34%)]" />
          <span className="absolute inset-0 shadow-[inset_0_0_60px_rgba(46,230,255,0.28)]" />
          <p
            className={cn(PIXEL, "absolute inset-x-[24px] text-center whitespace-nowrap text-[#ffe46b] uppercase", story ? "bottom-[40px] text-[64px]" : "bottom-[26px] text-[46px]", "leading-[1.3]")}
            style={{ textShadow: `5px 5px 0 ${PINK}, 0 0 26px rgba(255, 228, 107, 0.6)` }}
          >
            {t("gameClear")}
          </p>
        </div>
        {/* Under the screen: the maker's name and the power light. */}
        <div className="flex shrink-0 items-center justify-between px-[22px] pt-[14px]">
          <p className={cn(DISPLAY, "text-[26px] font-extrabold tracking-[0.3em] text-white/45 uppercase")}>{t("brand")}</p>
          <span className="size-[16px] rounded-full bg-[#5dff8a] shadow-[0_0_12px_4px_rgba(93,255,138,0.6)]" />
        </div>
        <FinisherStamp
          data={data}
          className={cn("absolute rotate-[-12deg]", story ? "-top-[70px] -left-[40px]" : "-top-[56px] -left-[34px] origin-top-left scale-[0.7]")}
        />
      </div>

      {/* The high-score table. */}
      <dl
        className={cn("relative flex w-full shrink-0 flex-col rounded-[22px] border-[4px] px-[40px]", story ? "gap-[16px] py-[28px]" : "gap-[8px] py-[18px]")}
        style={{
          borderColor: PINK,
          background: "rgba(12, 8, 32, 0.82)",
          boxShadow: "0 0 26px rgba(255, 62, 165, 0.45), inset 0 0 22px rgba(255, 62, 165, 0.22)",
        }}
      >
        {stat && (
          <ScoreRow label={stat.label} big story={story}>
            {stat.value}
          </ScoreRow>
        )}
        {data.rating && (
          <ScoreRow label={t("rating")} story={story}>
            <Stars rating={data.rating} className="text-[#ffe46b]" />
          </ScoreRow>
        )}
        <ScoreRow label={t(finishedKey(data.kind))} story={story}>
          {date}
        </ScoreRow>
      </dl>

      {/* The review, in an RPG dialogue box with its "more" arrow. */}
      {data.review && (
        <div className="relative w-full shrink-0 rounded-[18px] border-[6px] border-white bg-[#1b2370] p-[6px] shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
          <div className={cn("rounded-[10px] border-[3px] border-white/40", story ? "px-[34px] py-[26px]" : "px-[28px] py-[16px]")}>
            <p data-fit="" className={cn(PIXEL, "text-white [overflow-wrap:anywhere]", story ? "line-clamp-3 text-[30px]/[1.7]" : "line-clamp-2 text-[24px]/[1.7]")}>
              {data.review}
            </p>
          </div>
          <span className="absolute right-[28px] bottom-[20px] size-[22px] bg-white [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </div>
      )}

      <CardFooter host={host} {...footerUser(data)} className="relative w-full shrink-0" />
    </CardRoot>
  );
}
