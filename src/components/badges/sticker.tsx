import {
  BookCopyIcon,
  BookMarkedIcon,
  BookOpenIcon,
  ClapperboardIcon,
  FilmIcon,
  Flower2Icon,
  Gamepad2Icon,
  GhostIcon,
  LanguagesIcon,
  LaughIcon,
  LibraryIcon,
  MessageCircleIcon,
  PopcornIcon,
  RocketIcon,
  SearchIcon,
  ShapesIcon,
  SparklesIcon,
  TicketIcon,
  TrophyIcon,
  HeartIcon,
  JoystickIcon,
  TvIcon,
  type LucideIcon,
} from "lucide-react";
import type { BadgeId } from "@/core/badges";
import { cn } from "@/lib/utils";

/**
 * Each badge's sticker art: an icon on a colour. Printed stickers keep their colour in both themes; every colour
 * holds a white icon at ≥ 3:1.
 */
const ART: Record<BadgeId, { icon: LucideIcon; color: string }> = {
  "first-movie": { icon: ClapperboardIcon, color: "#c8372a" },
  "first-series": { icon: TvIcon, color: "#2560c4" },
  "first-book": { icon: BookOpenIcon, color: "#23794c" },
  "first-manga": { icon: MessageCircleIcon, color: "#b93d0b" },
  "first-game": { icon: Gamepad2Icon, color: "#1d6b8f" },
  "film-buff": { icon: FilmIcon, color: "#6d35d6" },
  "binge-master": { icon: PopcornIcon, color: "#a34a08" },
  "rookie-bookworm": { icon: BookMarkedIcon, color: "#4a7210" },
  bookworm: { icon: LibraryIcon, color: "#17603a" },
  "manga-marathon": { icon: BookCopyIcon, color: "#b3123b" },
  "level-up": { icon: JoystickIcon, color: "#4d3fb5" },
  "triple-feature": { icon: TicketIcon, color: "#8f5a05" },
  "kdrama-fan": { icon: Flower2Icon, color: "#c21f69" },
  "anime-fan": { icon: SparklesIcon, color: "#0c6a82" },
  "fear-conqueror": { icon: GhostIcon, color: "#27272f" },
  "laugh-track": { icon: LaughIcon, color: "#9a5b00" },
  stargazer: { icon: RocketIcon, color: "#322d86" },
  "hopeless-romantic": { icon: HeartIcon, color: "#d0173f" },
  sleuth: { icon: SearchIcon, color: "#3f3f48" },
  "subtitles-on": { icon: LanguagesIcon, color: "#0d6d64" },
  "genre-hopper": { icon: ShapesIcon, color: "#5b22bf" },
  "all-rounder": { icon: TrophyIcon, color: "#7d6300" },
};

const SIZES = {
  xs: { box: "size-7 border-2", icon: "size-3.5" },
  sm: { box: "size-12 border-[3px]", icon: "size-5" },
  md: { box: "size-16 border-4", icon: "size-7" },
  lg: { box: "size-24 border-[5px]", icon: "size-11" },
} as const;

/**
 * A badge as a die-cut sticker: a round colour with a white paper edge, a little gloss and a shadow. `locked`
 * draws the empty spot in the album instead (a dashed outline with a faint icon). Decorative: name it nearby.
 */
export function Sticker({ id, size = "md", locked = false, className }: { id: BadgeId; size?: keyof typeof SIZES; locked?: boolean; className?: string }) {
  const { icon: Icon, color } = ART[id];
  const s = SIZES[size];
  if (locked) {
    return (
      <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full border-dashed border-border bg-muted/40 text-muted-foreground/60", s.box, className)}>
        <Icon className={s.icon} strokeWidth={2.25} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: color }}
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-white text-white shadow-[0_1px_2px_rgb(0_0_0/0.25),0_6px_12px_-6px_rgb(0_0_0/0.5)]",
        s.box,
        className,
      )}
    >
      {/* The gloss of a printed sticker. */}
      <span className="absolute -top-1/4 -left-1/4 size-3/4 rounded-full bg-white/20" />
      <Icon className={cn("relative", s.icon)} strokeWidth={2.25} />
    </span>
  );
}
