"use client";

import { useEffect, useRef, useState } from "react";
import { countsUp, countUpText } from "@/core/motion";
import { appHydrated } from "./nav-motion";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that counts up from zero every time it's shown (ADR 0070, ADR 0080): Stats' figures, the collection's and
 * the album's summary. It counts when its page opens in the app, each time it scrolls back into view, and when its
 * value changes (another period). In the server's first HTML, a number already on screen stays as it is (no zero
 * flashing before the page hydrates); one further down counts once it's scrolled to. Reduced motion: never counts.
 */
export function CountUp({ value, ms = 800 }: { value: string; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Opened in the app: zero until it's in view, then it counts. The first HTML shows the number itself.
  const [frame, setFrame] = useState<string | null>(() => (appHydrated && countsUp(value) && !still() ? countUpText(value, 0) : null));
  const fromHtml = useRef(!appHydrated);
  // A new value (another period) starts again from zero at once, not after a frame of the new number.
  const [counted, setCounted] = useState(value);
  if (counted !== value) {
    setCounted(value);
    setFrame(countsUp(value) && !still() ? countUpText(value, 0) : null);
  }

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let run = 0;
    let visible: boolean | null = null;
    const moves = countsUp(value) && !still();
    const io = new IntersectionObserver(
      ([entry]) => {
        const now = entry!.isIntersecting;
        if (now === visible) return;
        visible = now;
        const onFirstScreen = fromHtml.current && now;
        fromHtml.current = false;
        if (!moves || onFirstScreen) return setFrame(null);
        cancelAnimationFrame(run);
        // Out of sight: back to zero, ready to count when it's back.
        if (!now) return setFrame(countUpText(value, 0));
        const start = performance.now();
        const tick = (t: number) => {
          const progress = (t - start) / ms;
          setFrame(progress >= 1 ? null : countUpText(value, progress));
          if (progress < 1) run = requestAnimationFrame(tick);
        };
        run = requestAnimationFrame(tick);
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(run);
    };
  }, [value, ms]);

  return <span ref={ref}>{frame ?? value}</span>;
}
