"use client";

import { useEffect, useId, useState } from "react";
import { nextActDelay, nextBlink, pickStonieAct, STONIE_ACT_MS, type StonieAct } from "@/core/stonie";
import { cn } from "@/lib/utils";

/**
 * Stonie, alive (ADR 0086): the mark from src/app/icon.svg drawn inline, so its eyes, cheeks and body can move. Now and
 * then it blinks (sometimes twice), and every 7 to 16 seconds it does something picked at random: a hop, a little
 * dance, a look around, a wink, a blush, a spin or a curious tilt. A mouse over it makes it hop. Nothing moves with
 * "Reduce motion" or while the tab is hidden. The moves are CSS (`.stonie` in globals.css).
 */
export function Stonie({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  const [act, setAct] = useState<StonieAct | null>(null);
  const [blink, setBlink] = useState<"once" | "twice" | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    let last: StonieAct | null = null;

    const blinkLoop = () => {
      const next = nextBlink(Math.random(), Math.random());
      later(() => {
        if (!document.hidden) {
          setBlink(next.double ? "twice" : "once");
          later(() => setBlink(null), next.double ? 420 : 200);
        }
        blinkLoop();
      }, next.delay);
    };
    const actLoop = () => {
      later(() => {
        if (!document.hidden) {
          const next = pickStonieAct(Math.random(), last);
          last = next;
          setAct(next);
          later(() => setAct(null), STONIE_ACT_MS[next]);
        }
        actLoop();
      }, nextActDelay(Math.random()));
    };
    blinkLoop();
    actLoop();
    return () => timers.forEach(clearTimeout);
  }, []);

  function hop() {
    if (act || !window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;
    setAct("hop");
    setTimeout(() => setAct((now) => (now === "hop" ? null : now)), STONIE_ACT_MS.hop);
  }

  const stone = `${id}-stone`;
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      data-act={act ?? undefined}
      data-blink={blink ?? undefined}
      onPointerEnter={(e) => e.pointerType === "mouse" && hop()}
      className={cn("stonie shrink-0 overflow-visible", className)}
    >
      <defs>
        <linearGradient id={stone} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#d3cbbf" />
          <stop offset="1" stopColor="#998f82" />
        </linearGradient>
      </defs>
      <g className="stonie-all">
        <path d="M31 7c10-1 20 3 25 11 5 8 5 20-1 28-6 8-15 11-24 11-10 0-18-4-23-12-4-7-4-17 1-25C14 12 22 8 31 7z" fill={`url(#${stone})`} />
        <path
          d="M31 7c10-1 20 3 25 11 5 8 5 20-1 28-6 8-15 11-24 11-10 0-18-4-23-12-4-7-4-17 1-25C14 12 22 8 31 7z"
          fill="none"
          stroke="#2a241e"
          strokeOpacity=".18"
          strokeWidth="1.5"
        />
        <path d="M17 17c5-5 12-6 18-5-7 2-12 5-15 10-2-1-4-3-3-5z" fill="#fff" fillOpacity=".45" />
        <g className="stonie-face">
          <ellipse className="stonie-eye stonie-eye-l" cx="24" cy="34" rx="3" ry="3.6" fill="#221c17" />
          <ellipse className="stonie-eye stonie-eye-r" cx="40" cy="34" rx="3" ry="3.6" fill="#221c17" />
          <circle className="stonie-cheek" cx="18.5" cy="41" r="3.2" fill="#e4512c" fillOpacity=".45" />
          <circle className="stonie-cheek" cx="45.5" cy="41" r="3.2" fill="#e4512c" fillOpacity=".45" />
          <path className="stonie-mouth" d="M27 41.5c2.8 3 7.2 3 10 0" fill="none" stroke="#221c17" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
