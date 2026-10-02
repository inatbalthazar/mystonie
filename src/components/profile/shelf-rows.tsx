"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ShowAll } from "@/components/show-all";
import { cn } from "@/lib/utils";

/** Two shelves: two 112px rows, the plank under the first (12px) and the bottom padding. */
const TWO_ROWS = 248;

/**
 * The Shelf's shelves, two of them until "Show all (N)" (ADR 0069). Items wrap by width, so how many fit in two rows
 * depends on the screen: the button shows only when they don't all fit.
 */
export function ShelfRows({ className, count, children }: { className: string; count: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const [all, setAll] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    // Fires once on observe too.
    const observer = new ResizeObserver(() => setOverflows(list.scrollHeight > TWO_ROWS + 1));
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <ul ref={ref} className={cn(className, !all && "max-h-[248px]")}>
        {children}
      </ul>
      {overflows && <ShowAll open={all} onToggle={() => setAll(!all)} count={count} />}
    </>
  );
}
