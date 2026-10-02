"use client";

import { LockIcon } from "lucide-react";
import { useImperativeHandle, useRef, useState, type PointerEvent, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";

export type StyleSwipeHandle = {
  /** Slides the card out, steps to the next (1) or previous (-1) style, and slides the new one in. */
  go: (step: 1 | -1) => void;
};

type Props = {
  ref?: Ref<StyleSwipeHandle>;
  /** Changes the style; called once the old card is out of sight (at once with reduced motion). */
  onStep: (step: 1 | -1, via: "swipe" | "button") => void;
  /** More than one style to swipe to. */
  canSwipe: boolean;
  /** One dot per style, the current one long; a Pro style's dot is a lock. None: no dots. */
  dots?: { index: number; locked: readonly boolean[] };
  /** The line under the card (the style's name). */
  label: ReactNode;
  className?: string;
  children: ReactNode;
};

const SWIPE_PX = 40;
/** A horizontal move this long starts a drag (shorter ones are taps or the start of a scroll). */
const DRAG_PX = 8;
const OUT_MS = 170;
const IN_MS = 380;
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A card you swipe for another style (ADR 0079). The card follows the finger and leans with it; let go past 40px
 * and it slides off that side while the next style comes in from the other, springing into place. Behind it, a
 * second card of the stack shows there are more. Every time a card is made, it nudges aside on its own twice, a moment
 * after it lands, to show it moves (until it's touched). Reduced motion: no drag, no slides, no nudge; the style changes
 * at once.
 */
export function StyleSwipe({ ref, onStep, canSwipe, dots, label, className, children }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const busy = useRef(false);
  // Each card made shows the nudge (the owner, 2026-10-02): mounted per card, it plays again every time.
  const [nudge, setNudge] = useState(true);

  function place(transform: string, transition = "none", opacity = "") {
    const el = card.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = transform;
    el.style.opacity = opacity;
  }

  function go(step: 1 | -1, via: "swipe" | "button" = "button") {
    const el = card.current;
    if (busy.current) return;
    setNudge(false);
    if (!el || still()) {
      place("");
      onStep(step, via);
      return;
    }
    busy.current = true;
    const w = el.offsetWidth;
    // Out the way it was pushed, leaning, fading...
    place(`translateX(${-step * w * 0.9}px) rotate(${-step * 7}deg)`, `transform ${OUT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${OUT_MS}ms ease-in`, "0");
    window.setTimeout(() => {
      // ...then the next style, drawn off to the other side, springs in.
      onStep(step, via);
      place(`translateX(${step * w * 0.55}px) rotate(${step * 5}deg)`, "none", "0");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          place("", `transform ${IN_MS}ms var(--ease-spring), opacity 200ms ease-out`);
          busy.current = false;
        }),
      );
    }, OUT_MS);
  }

  useImperativeHandle(ref, () => ({ go: (step) => go(step) }));

  function onPointerDown(e: PointerEvent) {
    if (busy.current) return;
    start.current = { x: e.clientX, y: e.clientY, dragging: false };
    setNudge(false);
  }

  function onPointerMove(e: PointerEvent) {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.dragging) {
      if (Math.abs(dx) < DRAG_PX || Math.abs(dx) <= Math.abs(e.clientY - s.y)) return;
      s.dragging = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (still()) return;
    // One style only: the card gives a little and comes back.
    const x = canSwipe ? dx : dx * 0.2;
    place(`translateX(${x}px) rotate(${x / 22}deg)`);
  }

  function onPointerUp(e: PointerEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (canSwipe && Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      setNudge(false);
      go(dx < 0 ? 1 : -1, "swipe");
    } else if (s.dragging) {
      place("", still() ? "none" : `transform 320ms var(--ease-spring)`);
    }
  }

  function onPointerCancel() {
    start.current = null;
    place("", still() ? "none" : `transform 320ms var(--ease-spring)`);
  }

  return (
    <div
      data-style-swipe
      className={cn("touch-pan-y select-none", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="relative">
        {canSwipe && (
          // The next card in the stack, peeking out behind.
          <div aria-hidden="true" className="absolute inset-0 translate-x-1.5 rotate-[3.5deg] scale-[0.97] rounded-xl bg-card shadow-sm ring-1 ring-border" />
        )}
        <div
          ref={card}
          className={cn("relative will-change-transform", nudge && canSwipe && "motion-safe:animate-nudge")}
          onAnimationEnd={(e) => e.target === e.currentTarget && setNudge(false)}
        >
          {children}
        </div>
      </div>
      {dots && canSwipe && (
        <div aria-hidden="true" className="mt-3 flex items-center justify-center gap-1.5">
          {dots.locked.map((locked, i) =>
            locked ? (
              <LockIcon
                key={i}
                className={cn("size-3 transition-colors duration-300", i === dots.index ? "text-brand" : "text-muted-foreground/60")}
                strokeWidth={2.5}
              />
            ) : (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 ease-(--ease-out-soft)",
                  i === dots.index ? "w-4 bg-brand" : "w-1.5 bg-muted-foreground/35",
                )}
              />
            ),
          )}
        </div>
      )}
      <div className="mt-2 text-center text-xs text-muted-foreground" aria-live="polite">
        {label}
      </div>
    </div>
  );
}
