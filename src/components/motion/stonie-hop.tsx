import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Stonie hopping on the spot (ADR 0070): the loader for the few waits a skeleton can't stand in for (the Atlas's map
 * unfolding, today's reel, the pre-watch check). Decoration only: the text next to it says what's happening. Still with
 * reduced motion.
 */
export function StonieHop({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src="/icon.svg" alt="" aria-hidden="true" width={size} height={size} unoptimized className={cn("origin-bottom animate-hop", className)} />;
}
