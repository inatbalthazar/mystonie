import {
  BookOpenIcon,
  CameraIcon,
  ClapperboardIcon,
  DramaIcon,
  Flower2Icon,
  Gamepad2Icon,
  GhostIcon,
  HeartIcon,
  LaughIcon,
  LibraryIcon,
  MessageCircleIcon,
  RocketIcon,
  SearchIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import type { ClubSlug } from "@/core/clubs";
import { cn } from "@/lib/utils";

/** Each club's crest: an icon on a colour (kept in both themes; every colour holds a white icon at ≥ 3:1). */
const ART: Record<ClubSlug, { icon: LucideIcon; color: string }> = {
  kdrama: { icon: Flower2Icon, color: "#b81d63" },
  anime: { icon: SparklesIcon, color: "#0c6a82" },
  manga: { icon: MessageCircleIcon, color: "#b3123b" },
  books: { icon: LibraryIcon, color: "#17603a" },
  games: { icon: Gamepad2Icon, color: "#1d6b8f" },
  cdrama: { icon: DramaIcon, color: "#9b2226" },
  "indian-cinema": { icon: ClapperboardIcon, color: "#b34700" },
  horror: { icon: GhostIcon, color: "#27272f" },
  romance: { icon: HeartIcon, color: "#c3173c" },
  scifi: { icon: RocketIcon, color: "#322d86" },
  mystery: { icon: SearchIcon, color: "#3f3f48" },
  comedy: { icon: LaughIcon, color: "#8f5400" },
  docs: { icon: CameraIcon, color: "#0d6d64" },
};

// A felt shield: the outline, and a stitched line inside it.
const SHIELD = "M6 4H94V68C94 92 72 106 50 116C28 106 6 92 6 68Z";
const STITCH = "M13 11H87V67C87 87 69 99 50 108C31 99 13 87 13 67Z";

/** A club as a felt crest sewn onto the page. Decorative: name it nearby. `size` is the width in pixels. */
export function ClubCrest({ club, size, className }: { club: ClubSlug; size: number; className?: string }) {
  const { icon: Icon, color } = ART[club] ?? { icon: BookOpenIcon, color: "#3f3f48" };
  return (
    <span aria-hidden="true" className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 100 120" className="absolute inset-0 size-full drop-shadow-[0_6px_8px_rgb(0_0_0/0.35)]">
        <path d={SHIELD} fill={color} />
        <path d={STITCH} fill="none" stroke="white" strokeOpacity="0.7" strokeWidth="2.5" strokeDasharray="5 4" />
      </svg>
      <Icon className="relative -mt-[12%] text-white" style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={2.25} />
    </span>
  );
}
