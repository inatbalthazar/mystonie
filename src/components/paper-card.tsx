import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A page of the scrapbook: a paper sheet "taped" onto the page, optionally with a rubber stamp in the corner.
 * Decoration only (aria-hidden); content keeps normal contrast and layout.
 */
export function PaperCard({ children, stamp, className }: { children: ReactNode; stamp?: string; className?: string }) {
  return (
    <section className={cn("relative rounded-2xl bg-card p-5 pt-7 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-12px_rgb(0_0_0/0.18)] ring-1 ring-border", className)}>
      <span aria-hidden="true" className="absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 -rotate-2 rounded-[2px] bg-brand-soft/90 shadow-sm ring-1 ring-brand/10" />
      {stamp && (
        <span
          aria-hidden="true"
          className="absolute top-4 right-4 rotate-[8deg] rounded-md border-2 border-brand/80 px-2 py-0.5 font-display text-[11px] font-extrabold tracking-[0.18em] text-brand/80 select-none"
        >
          {stamp}
        </span>
      )}
      {children}
    </section>
  );
}
