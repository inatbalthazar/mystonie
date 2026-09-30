import {
  BookOpenIcon,
  CalendarCheckIcon,
  ClapperboardIcon,
  FlagIcon,
  Flower2Icon,
  GhostIcon,
  GlobeIcon,
  HeartIcon,
  HourglassIcon,
  LaughIcon,
  RocketIcon,
  SearchIcon,
  ShapesIcon,
  SparklesIcon,
  TvIcon,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { ChallengeSlug } from "@/core/challenges";
import { cn } from "@/lib/utils";

/**
 * Each challenge's patch art: an icon on a colour. Patches keep their colour in both themes (and on cards); every
 * colour holds a white icon at ≥ 3:1.
 */
const ART: Record<ChallengeSlug, { icon: LucideIcon; color: string }> = {
  "new-chapter": { icon: BookOpenIcon, color: "#23794c" },
  "love-stories": { icon: HeartIcon, color: "#c3173c" },
  "world-tour": { icon: GlobeIcon, color: "#0d6d64" },
  "laugh-lines": { icon: LaughIcon, color: "#9a5b00" },
  "anime-month": { icon: SparklesIcon, color: "#0c6a82" },
  "movie-marathon": { icon: ClapperboardIcon, color: "#b8321f" },
  "out-of-this-world": { icon: RocketIcon, color: "#322d86" },
  "box-set": { icon: TvIcon, color: "#2560c4" },
  "case-files": { icon: SearchIcon, color: "#3f3f48" },
  "fright-month": { icon: GhostIcon, color: "#27272f" },
  "kdrama-month": { icon: Flower2Icon, color: "#b81d63" },
  "triple-threat": { icon: ShapesIcon, color: "#5b22bf" },
  "finish-four": { icon: FlagIcon, color: "#b33a0a" },
  "twenty-hours": { icon: HourglassIcon, color: "#80520a" },
  "twelve-days": { icon: CalendarCheckIcon, color: "#17603a" },
};

/**
 * A challenge as an embroidered patch: a round colour with a stitched edge, a twill border and a shadow, sized in
 * pixels so cards (1080px wide) and pages share it. `locked` draws the patch still to earn (paler, dashed).
 * Decorative: name it nearby.
 */
export function ChallengePatch({ slug, size, locked = false, className }: { slug: ChallengeSlug; size: number; locked?: boolean; className?: string }) {
  const { icon: Icon, color } = ART[slug];
  const style: CSSProperties = {
    width: size,
    height: size,
    borderWidth: Math.max(2, Math.round(size * 0.07)),
    ...(locked ? {} : { backgroundColor: color, borderColor: color }),
  };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full",
        locked
          ? "border-dashed border-border bg-muted/50 text-muted-foreground/70"
          : "text-white shadow-[0_1px_2px_rgb(0_0_0/0.3),0_8px_16px_-8px_rgb(0_0_0/0.55)] [filter:saturate(1.05)]",
        className,
      )}
    >
      {!locked && (
        // The stitching: a dashed ring just inside the twill edge, and a faint weave.
        <>
          <span
            className="absolute rounded-full border-dashed border-white/70"
            style={{ inset: Math.round(size * 0.06), borderWidth: Math.max(1, Math.round(size * 0.022)) }}
          />
          <span className="absolute inset-0 rounded-full bg-[repeating-linear-gradient(45deg,rgb(255_255_255/0.07)_0_2px,transparent_2px_5px)]" />
        </>
      )}
      <Icon className="relative" style={{ width: size * 0.44, height: size * 0.44 }} strokeWidth={2.25} />
    </span>
  );
}
