import { PlaneIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A country as an inked passport stamp (ADR 0092): the picture of a Journal article about a place, which has no
 * poster. The ISO code big, the country's name small when there's room (`name`).
 */
export function PassportStamp({ country, name, className }: { country: string; name?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex aspect-square -rotate-6 flex-col items-center justify-center gap-0.5 rounded-[28%] border-[3px] border-double border-brand/80 bg-brand-soft/40 p-1 text-brand dark:bg-brand/10",
        className,
      )}
    >
      <PlaneIcon className="size-[0.9em]" />
      <span className="font-display text-[1.6em] leading-none font-extrabold tracking-[0.04em]">{country}</span>
      {name && <span className="line-clamp-1 max-w-full px-1 text-center text-[0.55em] font-bold tracking-[0.08em] uppercase [&:lang(th)]:tracking-normal">{name}</span>}
    </span>
  );
}
