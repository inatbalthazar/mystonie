import { useTranslations } from "next-intl";
import type { CardSize } from "@/core/cards/types";
import { cn } from "@/lib/utils";
import { GOLD_FOIL, GOLD_INK } from "./gold";

// The rankings' Pro look (ADR 0099): black velvet in a gilt frame, gold serif, a gold PRO seal. Shared by the Hall of
// Fame and the gold tier list.

/** The book face (Cormorant Garamond) with lining figures (its old-style "10" reads "1o"), and the Noto fallbacks. */
export const GOLD_SERIF = "[font-family:var(--card-serif)] [font-variant-numeric:lining-nums]";

/** Gold pressed into velvet: the top edge catches the light. */
export const STAMPED = "0 1px 0 rgba(255, 244, 214, 0.35), 0 -1px 0 rgba(0, 0, 0, 0.6), 0 4px 10px rgba(0, 0, 0, 0.5)";

export const IVORY = "#f3ead6";

/** Velvet: near black, warmed by the card's colour (its first poster's). */
export const VELVET = "color-mix(in oklab, var(--card-bg) 14%, #0b0806)";

const STAR = "★";

/** The velvet, its light, the gilt frame and the PRO seal, under everything else on the card. */
export function VelvetBackdrop({ size }: { size: CardSize }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: VELVET }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_18%,rgba(255,226,160,0.12),transparent_70%),radial-gradient(ellipse_120%_80%_at_50%_120%,rgba(0,0,0,0.7),transparent_60%)]" />
      {/* The gilt frame: foil, then a fine line inside it. */}
      <div className="pointer-events-none absolute inset-[40px] rounded-[6px] p-[6px]" style={{ background: GOLD_FOIL }}>
        <div className="size-full rounded-[3px]" style={{ background: VELVET }} />
      </div>
      <div className="pointer-events-none absolute inset-[62px] rounded-[2px] border-[1.5px]" style={{ borderColor: GOLD_INK }} />
      <ProSeal className={size === "story" ? "top-[54px] right-[54px]" : "top-[46px] right-[46px] scale-[0.82]"} />
    </>
  );
}

/** The gold seal in the corner: the card was made with Mystonie Pro, and says so. */
export function ProSeal({ className }: { className?: string }) {
  const t = useTranslations("Card");
  return (
    <div
      className={cn("absolute z-10 flex size-[150px] rotate-[12deg] items-center justify-center rounded-full p-[7px] shadow-[0_10px_24px_rgba(0,0,0,0.55)]", className)}
      style={{ background: GOLD_FOIL }}
    >
      <div className="flex size-full flex-col items-center justify-center rounded-full border-[2px] border-dashed border-[#5a3d10]/60 text-[#3a2606]">
        <span className="text-[30px] leading-none">{STAR}</span>
        <span className={cn(GOLD_SERIF, "text-[44px] leading-none font-bold tracking-[0.06em]")}>{t("proSeal")}</span>
        <span className="mt-[3px] text-[13px] leading-none font-bold tracking-[0.2em] uppercase">{t("brand")}</span>
      </div>
    </div>
  );
}
