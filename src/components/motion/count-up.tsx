"use client";

import { useEffect, useState } from "react";
import { countsUp, countUpText } from "@/core/motion";
import { appHydrated } from "./nav-motion";

/**
 * A big number that counts up from zero when its page opens in the app (ADR 0070): Stats' figures, the collection's
 * and the album's summary. In the server's first HTML it is just the number (no zero flashing before the page
 * hydrates), and with reduced motion too. Counts once: later changes (a filter) show at once.
 */
export function CountUp({ value, ms = 700 }: { value: string; ms?: number }) {
  const [counting] = useState(() => appHydrated && countsUp(value) && !matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [frame, setFrame] = useState<string | null>(() => (counting ? countUpText(value, 0) : null));

  useEffect(() => {
    if (!counting) return;
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = (now - start) / ms;
      setFrame(progress >= 1 ? null : countUpText(value, progress));
      if (progress < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(id);
      setFrame(null);
    };
    // Once, on mount: the value it counts to is the one it opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counting]);

  return <>{frame ?? value}</>;
}
